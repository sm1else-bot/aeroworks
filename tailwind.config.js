/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Autodesk-style engineering workspace palette.
        viewport: '#1E1E1E', // 3D canvas background
        panel: '#2B2B2B', // panel container fill
        'panel-raised': '#323232', // recessed segmented strip cells
        divider: '#3D3D3D', // ultra-subtle dividers / borders
        track: '#444444', // thin slider track
        ink: '#E2E2E2', // high-contrast value text
        muted: '#A0A0A0', // flat muted unit / label text
        engineering: '#007ACC', // flat solid selection blue
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
      },
    },
  },
  plugins: [],
};
