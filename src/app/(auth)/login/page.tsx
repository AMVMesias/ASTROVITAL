import { Header } from "../../../frontend/components/layout/Header";
import { Footer } from "../../../frontend/components/layout/Footer";
import { LoginForm } from "../../../frontend/features/auth/components/LoginForm";
export default function Login() {
  return (
    <>
      <Header />
      <main className="interior">
        <h1>Iniciar sesión</h1>
        <p>Accede a NASA Health.</p>
        <LoginForm />
      </main>
      <Footer />
    </>
  );
}
