import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './renderer/App';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  defaultRadius: 'md',
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <MantineProvider theme={theme} defaultColorScheme="light">
    <App />
  </MantineProvider>
);