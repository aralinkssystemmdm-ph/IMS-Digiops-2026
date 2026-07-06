
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-offwhite pt-20 pb-10 border-t border-brand-light/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
             <div className="flex items-center space-x-2 mb-8">
                <div className="w-9 h-9 bg-brand-red rounded-xl flex items-center justify-center shadow-lg shadow-brand-red/10">
                  <span className="text-white font-bold text-xl">A</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-brand-deep">Aralinks <span className="text-brand-accent">Inventory</span></span>
              </div>
              <p className="text-brand-steel text-sm font-medium leading-relaxed">
                Empowering businesses with intelligent inventory solutions that scale with your ambitions. Built for the modern enterprise.
              </p>
          </div>
          
          <div>
            <h4 className="text-xs font-black text-brand-deep uppercase tracking-[0.2em] mb-8">Solution</h4>
            <ul className="space-y-4 text-sm font-medium text-brand-steel">
              <li><a href="#" className="hover:text-brand-red transition-colors">Smart Tracking</a></li>
              <li><a href="#" className="hover:text-brand-red transition-colors">Vendor Portal</a></li>
              <li><a href="#" className="hover:text-brand-red transition-colors">Analytics API</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-brand-deep uppercase tracking-[0.2em] mb-8">Company</h4>
            <ul className="space-y-4 text-sm font-medium text-brand-steel">
              <li><a href="#" className="hover:text-brand-red transition-colors">Team</a></li>
              <li><a href="#" className="hover:text-brand-red transition-colors">Press Kit</a></li>
              <li><a href="#" className="hover:text-brand-red transition-colors">Privacy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-brand-deep uppercase tracking-[0.2em] mb-8">Connect</h4>
            <div className="flex space-x-4 mb-8">
              <div className="w-11 h-11 bg-white border border-brand-light/40 rounded-xl flex items-center justify-center text-brand-steel hover:text-brand-red hover:border-brand-red/20 transition-all cursor-pointer shadow-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </div>
              <div className="w-11 h-11 bg-white border border-brand-light/40 rounded-xl flex items-center justify-center text-brand-steel hover:text-brand-red hover:border-brand-red/20 transition-all cursor-pointer shadow-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </div>
            </div>
            <p className="text-xs font-bold text-brand-light tracking-wide uppercase">© 202 Aralinks System</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
