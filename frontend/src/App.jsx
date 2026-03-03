import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import MonitorDetail from './pages/MonitorDetail.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitors/:id" element={<MonitorDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
