// ═══════════════════════════════════════════════════════════
// URLSessionTransports — implementações HTTP dos 3 transports
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — Prompt #23. p1fast-core define 3 protocols
// (SyncTransport / PullTransport / TelemetryTransport) que
// recebem Codable e devolvem Codable. Aqui faço o wrapper
// URLSession com:
//   - JSON encode do request
//   - POST com headers Supabase (apikey + Authorization Bearer)
//   - JSON decode do response
//
// V1 usa só SUPABASE_ANON_KEY (sem JWT real). RLS no Supabase
// continua ativo mas com policies que aceitam anon. Sprint
// posterior troca por sessão Supabase Auth real.
//
// Erros HTTP (não-2xx) viram TransportError pra drainer reagir
// com backoff. Network errors propagam direto (drainer trata).

import Foundation
import P1FastCore

public enum TransportError: Error, LocalizedError {
    case notConfigured
    case invalidUrl
    case httpError(status: Int, body: String?)
    case noData

    public var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Supabase não configurada (.env.xcconfig vazio?)"
        case .invalidUrl:
            return "URL Supabase inválida"
        case .httpError(let s, let body):
            return "HTTP \(s)\(body.map { ": \($0.prefix(200))" } ?? "")"
        case .noData:
            return "Resposta sem corpo"
        }
    }
}

// MARK: - Helpers comuns

enum SupabaseHTTP {
    static let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.timeoutIntervalForResource = 60
        cfg.waitsForConnectivity = false  // drainer cuida do retry
        return URLSession(configuration: cfg)
    }()

    /// Envia POST com JSON pra Edge Function endpoint, retorna Codable.
    /// Bloqueante (sync) — protocols pediam `throws -> ...`. Internamente
    /// usa DispatchSemaphore pra adaptar dataTask. Aceitável pra drainer
    /// que já roda em background queue.
    static func postJSON<Req: Encodable, Resp: Decodable>(
        path: String,
        body: Req,
        respType: Resp.Type
    ) throws -> Resp {
        guard Configuration.isConfigured else {
            throw TransportError.notConfigured
        }
        guard let base = Configuration.supabaseBaseUrl,
              let url = URL(string: "\(base.absoluteString)/functions/v1/\(path)")
        else {
            throw TransportError.invalidUrl
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Configuration.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(Configuration.supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        req.httpBody = try encoder.encode(body)

        let (data, response) = try syncDataTask(request: req)

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let bodyStr = String(data: data, encoding: .utf8)
            throw TransportError.httpError(status: http.statusCode, body: bodyStr)
        }

        guard !data.isEmpty else { throw TransportError.noData }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Resp.self, from: data)
    }

    /// GET com query string. Usado pelo PullTransport.
    static func getJSON<Resp: Decodable>(
        path: String,
        query: [String: String],
        respType: Resp.Type
    ) throws -> Resp {
        guard Configuration.isConfigured else {
            throw TransportError.notConfigured
        }
        guard let base = Configuration.supabaseBaseUrl,
              var comp = URLComponents(string: "\(base.absoluteString)/functions/v1/\(path)")
        else {
            throw TransportError.invalidUrl
        }
        comp.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = comp.url else { throw TransportError.invalidUrl }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Configuration.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(Configuration.supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        let (data, response) = try syncDataTask(request: req)

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let bodyStr = String(data: data, encoding: .utf8)
            throw TransportError.httpError(status: http.statusCode, body: bodyStr)
        }
        guard !data.isEmpty else { throw TransportError.noData }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Resp.self, from: data)
    }

    /// Adapter dataTask → sync. Aceitável pra drainer que roda em
    /// background. SwiftUI nunca chama isso direto.
    private static func syncDataTask(request: URLRequest) throws -> (Data, URLResponse) {
        let semaphore = DispatchSemaphore(value: 0)
        var resultData: Data?
        var resultResponse: URLResponse?
        var resultError: Error?

        let task = session.dataTask(with: request) { d, r, e in
            resultData = d
            resultResponse = r
            resultError = e
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 60)

        if let err = resultError { throw err }
        guard let d = resultData, let r = resultResponse else {
            throw TransportError.noData
        }
        return (d, r)
    }
}

// MARK: - SyncTransport

public final class URLSessionSyncTransport: SyncTransport, @unchecked Sendable {
    public init() {}

    public func send(_ rows: [SyncRequestRow]) throws -> SyncResult {
        struct Wrapper: Encodable { let rows: [SyncRequestRow] }
        return try SupabaseHTTP.postJSON(
            path: "sync",
            body: Wrapper(rows: rows),
            respType: SyncResult.self
        )
    }
}

// MARK: - PullTransport

public final class URLSessionPullTransport: PullTransport, @unchecked Sendable {
    public init() {}

    public func pull(_ request: PullRequest) throws -> PullResponse {
        // Sync via POST por consistência (Edge Function aceita ambos GET e POST,
        // POST evita query string limit).
        return try SupabaseHTTP.postJSON(
            path: "pull",
            body: request,
            respType: PullResponse.self
        )
    }
}

// MARK: - TelemetryTransport

public final class URLSessionTelemetryTransport: TelemetryTransport, @unchecked Sendable {
    public init() {}

    public func upload(_ request: IngestRequest) throws -> IngestResult {
        return try SupabaseHTTP.postJSON(
            path: "ingest",
            body: request,
            respType: IngestResult.self
        )
    }
}
