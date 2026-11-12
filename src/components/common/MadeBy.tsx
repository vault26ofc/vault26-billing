import React from 'react';

// Small credit at the very bottom of every screen. Kept quiet on purpose -
// small, grey, under the shop's own content - so Vault 26 stays the brand
// people see. Opens the AR Tech Studio website in a new tab.
export const MadeBy: React.FC = () => (
  <footer className="pt-4 pb-6 px-4 flex justify-center no-print">
    <a
      href="https://artechstudio.co.in"
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 text-xs text-v26-muted hover:text-v26-ink"
    >
      <img src="/ar-tech-studio.png" alt="AR Tech Studio" width={24} height={24} className="w-6 h-6" />
      <span>
        Developed and maintained by <span className="font-bold">AR Tech Studio</span>
      </span>
    </a>
  </footer>
);
