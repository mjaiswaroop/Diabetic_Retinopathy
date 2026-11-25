import React from 'react';
import './globals.css';

export const metadata = {
  title: 'DR Screening Assistant',
  description: 'Explainable AI Diabetic Retinopathy Screening for Rural Healthcare'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

