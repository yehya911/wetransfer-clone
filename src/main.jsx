import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UploadView from './components/UploadView.jsx'
import DownloadView from './components/DownloadView.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadView />} />
        <Route path="/p/:code" element={<DownloadView />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
