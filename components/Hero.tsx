
import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 lg:pt-32 lg:pb-24 text-center px-4">
      {/* Background decoration with new palette colors */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-brand-light rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-brand-steel/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-brand-orange/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold text-brand-deep tracking-tight mb-6">
          Aralinks <span className="text-brand-red">Inventory</span>
        </h1>
        <p className="text-xl md:text-2xl text-brand-steel font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
          Smart, Fast, and Reliable Inventory Management for the modern digital era.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <button className="w-full sm:w-auto px-10 py-4 bg-brand-deep text-white rounded-2xl font-bold shadow-xl shadow-brand-deep/20 hover:bg-brand-deep/90 hover:translate-y-[-2px] transition-all">
            Schedule a Demo
          </button>
          <button className="w-full sm:w-auto px-10 py-4 bg-white text-brand-deep border border-brand-light/40 rounded-2xl font-bold hover:bg-white/80 transition-all shadow-sm">
            Explore Features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
