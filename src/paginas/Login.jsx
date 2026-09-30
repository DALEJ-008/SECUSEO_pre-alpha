import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/services/api';

// Migrado de Frontend/HTML/InicioSesion.html (antes usaba Alpine.js para el
// toggle Iniciar sesión / Registrarse; aquí es un simple useState).
export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regDob, setRegDob] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('action', 'login');
    fd.append('email', loginEmail);
    fd.append('password', loginPassword);
    try {
      const { res, data } = await apiJson('/login/', { method: 'POST', body: fd });
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'No se pudo iniciar sesión');
        return;
      }
      navigate(data.redirect || '/');
    } catch (err) {
      alert('Error de red');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('action', 'register');
    fd.append('name', regName);
    fd.append('email', regEmail);
    fd.append('password', regPassword);
    fd.append('telefono', regTelefono);
    fd.append('dob', regDob);
    try {
      const { res, data } = await apiJson('/login/', { method: 'POST', body: fd });
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'No se pudo registrar');
        return;
      }
      if (data.verify_user_id) {
        const code = prompt('Ingresa el código enviado al teléfono' + (data.debug_code ? ` (debug: ${data.debug_code})` : ''));
        if (!code) { alert('Código requerido'); return; }
        const vfd = new FormData();
        vfd.append('user_id', data.verify_user_id);
        vfd.append('code', code);
        const { res: vres, data: vdata } = await apiJson('/verify-phone/', { method: 'POST', body: vfd });
        if (!vres.ok || !vdata?.ok) { alert(vdata?.error || 'Verificación fallida'); return; }
        navigate('/');
        return;
      }
      navigate(data.redirect || '/');
    } catch (err) {
      alert('Error de red');
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        backgroundColor: 'var(--background-color)',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e6e6e6' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }}
    >
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-2xl rounded-2xl">
        <div className="flex justify-center">
          <img alt="SECUSEO Logo" className="h-16 w-auto" src="/img/Logo.png" />
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-800">Bienvenido a SECUSEO</h2>
        <p className="text-center text-gray-500">Reporta y visualiza zonas peligrosas en Funza.</p>

        <div className="space-y-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-2 font-medium text-center transition-colors ${isLogin ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
              onClick={() => setIsLogin(true)}
            >
              Iniciar Sesión
            </button>
            <button
              className={`flex-1 py-2 font-medium text-center transition-colors ${!isLogin ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
              onClick={() => setIsLogin(false)}
            >
              Registrarse
            </button>
          </div>

          {isLogin ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Correo electrónico" type="email" required
                value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
              />
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Contraseña" type="password" required
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              />
              <button
                className="w-full px-4 py-3 font-semibold text-white bg-primary rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-300"
                type="submit"
              >
                Ingresar
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleRegister}>
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Nombre completo" type="text" required
                value={regName} onChange={(e) => setRegName(e.target.value)}
              />
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Correo electrónico" type="email" required
                value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
              />
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Contraseña" type="password" required
                value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
              />
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base"
                placeholder="Teléfono (ej: +573001112233)" type="tel" required
                value={regTelefono} onChange={(e) => setRegTelefono(e.target.value)}
              />
              <input
                className="form-input w-full px-4 py-3 rounded-lg text-base text-gray-500"
                placeholder="Fecha de Nacimiento"
                type="date" required
                value={regDob} onChange={(e) => setRegDob(e.target.value)}
              />
              <button
                className="w-full px-4 py-3 font-semibold text-white bg-primary rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-300"
                type="submit"
              >
                Registrarse
              </button>
            </form>
          )}

          <div className="text-center">
            <a className="text-sm font-medium text-primary hover:underline" href="#">¿Olvidaste tu contraseña?</a>
          </div>
        </div>
      </div>
    </div>
  );
}
