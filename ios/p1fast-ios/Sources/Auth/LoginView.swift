// ═══════════════════════════════════════════════════════════
// LoginView — tela de entrada do app (MS-10 A.2)
// ═══════════════════════════════════════════════════════════
// Decisão Flávio 2026-05-06: 3 maneiras de entrar
//   1. Apple Sign In (botão nativo iOS — placeholder nesta sprint)
//   2. Google Sign In (placeholder nesta sprint)
//   3. Email + senha (funcional via SessionManager)
//
// Em Debug build, botão extra "Entrar como Flávio (dev)" tenta login
// com Flaviomarques@me.com + senha 1212 (precisa conta criada no
// dashboard Supabase — Authentication → Users → Add user). Em
// Release, esse botão não aparece.
//
// Apple e Google ficam como placeholder porque exigem config extra:
//   - Apple: capability "Sign in with Apple" no Xcode + nonce flow
//     no dashboard Supabase
//   - Google: GoogleSignIn SDK ou Supabase OAuth web redirect
// Ambos viram sub-sprints dedicadas — implementar só o atalho aqui.

import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionManager

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var showPassword: Bool = false
    @State private var showEmailFields: Bool = false
    /// Mensagem temporária quando o user toca num provider ainda não
    /// implementado (Apple/Google). SessionManager.lastError fica
    /// reservado pra erros reais de auth.
    @State private var infoTemporario: String?

    var body: some View {
        ZStack {
            Color.surface.ignoresSafeArea()
            ScrollView {
                content
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, 48)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            header
            if !session.isClientReady {
                naoConfiguradoBanner
            } else {
                providerStack
                if showEmailFields { emailFields }
                if let info = infoTemporario, !info.isEmpty { infoLine(info) }
                if let erro = session.lastError, !erro.isEmpty { erroLine(erro) }
                #if DEBUG
                devBypass
                #endif
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("P1 FAST")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.32)
                .foregroundStyle(Color.textFaint)
            Text("Entrar")
                .font(.system(size: 36, weight: .semibold))
                .tracking(-0.9)
                .foregroundStyle(Color.text)
            Text("Acompanhe seus stints, voltas e métricas no track day.")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.textMuted)
                .padding(.top, 4)
        }
    }

    private var naoConfiguradoBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Servidor não configurado")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.atencao)
            Text("Esta build não tem credenciais Supabase. Login fica indisponível até as variáveis SUPABASE_URL e SUPABASE_ANON_KEY entrarem no xcconfig.")
                .font(Font.captionP1)
                .foregroundStyle(Color.textMuted)
        }
        .padding(Spacing.md)
        .background(Color.surfaceRaised)
        .cornerRadius(Radius.md)
    }

    // MARK: - Provider stack (Apple/Google/Email)

    private var providerStack: some View {
        VStack(spacing: Spacing.sm) {
            providerButton(label: "Entrar com Apple", primary: true) {
                infoTemporario = "Apple Sign In: configuração específica fica pra próxima sprint. Use email por enquanto."
            }
            providerButton(label: "Entrar com Google", primary: false) {
                infoTemporario = "Google Sign In: configuração específica fica pra próxima sprint. Use email por enquanto."
            }
            providerButton(label: showEmailFields ? "Cancelar" : "Entrar com email", primary: false) {
                infoTemporario = nil
                withAnimation { showEmailFields.toggle() }
            }
        }
    }

    private func providerButton(label: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(Font.bodyP1)
                .foregroundStyle(primary ? Color.surface : Color.text)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(primary ? Color.accent : Color.surfaceRaised)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                        .stroke(primary ? Color.clear : Color.border, lineWidth: 1)
                )
                .cornerRadius(Radius.md)
        }
        .buttonStyle(.plain)
        .disabled(session.isWorking)
    }

    // MARK: - Email + senha inline

    private var emailFields: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            inputField(label: "Email", text: $email, isSecure: false, keyboardType: .emailAddress)
            passwordField
            Button(action: signInTap) {
                Text(session.isWorking ? "Entrando…" : "Entrar")
                    .font(Font.bodyP1)
                    .foregroundStyle(Color.surface)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(canSignIn ? Color.accent : Color.textFaint)
                    .cornerRadius(Radius.md)
            }
            .buttonStyle(.plain)
            .disabled(!canSignIn)
        }
    }

    /// Campo de senha com toggle visual (olhinho). Quando `showPassword`
    /// estiver ligado, mostra TextField — não SecureField — pra que o
    /// caractere apareça em claro. autocapitalization/autocorrect/
    /// textContentType ficam desligados pra evitar interferência do iOS
    /// (sugestão de senha forte, capitalização do primeiro char etc.)
    /// que faria o user "achar que digitou certo" sem ter digitado.
    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SENHA")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.66)
                .foregroundStyle(Color.textFaint)
            HStack(spacing: 8) {
                Group {
                    if showPassword {
                        TextField("", text: $password)
                            .keyboardType(.default)
                            .textContentType(.password)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                    } else {
                        SecureField("", text: $password)
                            .textContentType(.password)
                    }
                }
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.text)
                Button(action: { showPassword.toggle() }) {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(Color.textMuted)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showPassword ? "Ocultar senha" : "Mostrar senha")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .cornerRadius(Radius.md)
        }
    }

    private var canSignIn: Bool {
        !session.isWorking
            && !email.trimmingCharacters(in: .whitespaces).isEmpty
            && !password.isEmpty
    }

    private func inputField(label: String, text: Binding<String>, isSecure: Bool, keyboardType: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.66)
                .foregroundStyle(Color.textFaint)
            Group {
                if isSecure {
                    SecureField("", text: text)
                } else {
                    TextField("", text: text)
                        .keyboardType(keyboardType)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
            }
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(Color.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            )
            .cornerRadius(Radius.md)
        }
    }

    private func signInTap() {
        Task {
            await session.signIn(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password
            )
        }
    }

    // MARK: - Erro inline

    private func erroLine(_ msg: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Não consegui entrar")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.rec)
            Text(msg)
                .font(Font.bodyP1)
                .foregroundStyle(Color.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(Color.surfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .stroke(Color.rec.opacity(0.4), lineWidth: 1)
        )
        .cornerRadius(Radius.md)
    }

    private func infoLine(_ msg: String) -> some View {
        Text(msg)
            .font(Font.captionP1)
            .foregroundStyle(Color.atencao)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Dev bypass (só Debug build)

    #if DEBUG
    private var devBypass: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()
                .background(Color.border)
                .padding(.vertical, Spacing.sm)
            Text("ATALHOS DEV")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.textFaint)
            Button(action: devBypassTap) {
                Text(session.isWorking ? "Entrando como Flávio…" : "Entrar como Flávio (dev)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.surfaceRaised)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    )
                    .cornerRadius(Radius.sm)
            }
            .buttonStyle(.plain)
            .disabled(session.isWorking)
            Text("Tenta logar com Flaviomarques@me.com / 121212.")
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Color.textFaint)
        }
        .task {
            // Bancada de testes (11/07): --p1-login-dev aperta este botão sozinho,
            // pra validação automatizada de telas logadas no simulador. Só Debug.
            if ProcessInfo.processInfo.arguments.contains("--p1-login-dev"), !session.isWorking {
                devBypassTap()
            }
        }
    }

    private func devBypassTap() {
        Task {
            // Senha "121212" — Supabase exige mínimo 6 chars; "1212"
            // original foi rejeitado. Mesmo espírito (curta, fácil).
            await session.signIn(email: "Flaviomarques@me.com", password: "121212")
        }
    }
    #endif
}

#Preview("LoginView") {
    LoginView()
        .environmentObject(SessionManager(client: nil))
}
