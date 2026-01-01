
import React from 'react';
import { FeatureCardProps } from '../types';

export const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, color }) => {
  return (
    <div className="glass p-6 rounded-2xl hover:scale-105 transition-transform duration-300 border-l-4" style={{ borderColor: color }}>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-2xl bg-opacity-20`} style={{ backgroundColor: color, color: color }}>
        <i className={icon}></i>
      </div>
      <h3 className="gaming-font text-lg font-bold mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
};
