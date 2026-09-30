import { Routes, Route } from 'react-router-dom';
import Login from './paginas/Login';
import Home from './paginas/Inicio';
import ReportForm from './paginas/ReportForm';
import AdminPanel from './paginas/PanelAdmin';
import ReportDetail from './paginas/DetalleReporte';

// Rutas equivalentes a Backend/urls.py:
//  /            -> pagina_principal      -> Home
//  /login/      -> inicio_sesion         -> Login
//  /reporte/form/ -> formulario_reporte  -> ReportForm
//  /admin-panel/  -> panel_administracion -> AdminPanel
//  /reportes/:id/ -> reporte_detalle_page -> ReportDetail
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/reporte/form" element={<ReportForm />} />
      <Route path="/admin-panel" element={<AdminPanel />} />
      <Route path="/reportes/:id" element={<ReportDetail />} />
    </Routes>
  );
}
