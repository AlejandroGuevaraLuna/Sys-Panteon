import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import Login from "./features/auth/Login";
import MainLayout from "./components/layout/MainLayout";
import Inicio from "./pages/Inicio";
import Panteones from "./features/panteones/Panteones";
import PanteonDetalle from "./features/panteones/PanteonDetalle";
import Secciones from "./features/secciones/Secciones";
import SeccionDetalle from "./features/secciones/SeccionDetalle";
import Lineas from "./features/lineas/Lineas";
import LineaDetalle from "./features/lineas/LineaDetalle";
import Fosas from "./features/fosas/Fosas";
import FosaDetalle from "./features/fosas/FosaDetalle";
import Gavetas from "./features/gavetas/Gavetas";
import GavetaDetalle from "./features/gavetas/GavetaDetalle";
import Servicios from "./features/servicios/Servicios";
import Memorandums from "./features/memorandums/Memorandums";
import Reportes from "./features/reportes/Reportes";
import Configuracion from "./features/configuracion/Configuracion";
import Diagnostico from "./pages/Diagnostico";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login (público) */}
          <Route path="/login" element={<Login />} />

          {/* App principal (protegida) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Inicio />} />
            <Route path="panteones" element={<Panteones />} />
            <Route path="panteones/:id" element={<PanteonDetalle />} />
            <Route path="secciones" element={<Secciones />} />
            <Route path="secciones/:id" element={<SeccionDetalle />} />
            <Route path="lineas" element={<Lineas />} />
            <Route path="lineas/:id" element={<LineaDetalle />} />
            <Route path="fosas" element={<Fosas />} />
            <Route path="fosas/:id" element={<FosaDetalle />} />
            <Route path="gavetas" element={<Gavetas />} />
            <Route path="gavetas/:id" element={<GavetaDetalle />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="memorandums" element={<Memorandums />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="diagnostico" element={<Diagnostico />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
