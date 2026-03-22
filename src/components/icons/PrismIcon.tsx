interface PrismIconProps {
  className?: string;
  size?: number;
}

export function PrismIcon({ className, size = 24 }: PrismIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="5 15 90 70"
      width={size}
      height={size}
      style={{ display: 'block' }}
      className={className}
      aria-label="Maxwell - Entropy Reduction Assistant"
    >
      {/* Light gray background for white light visibility */}
      <rect x="5" y="15" width="90" height="70" fill="#f5f5f5" rx="8" />
      
      <polygon 
        points="12.7,81.8 50,18 87.3,81.8" 
        fill="#e0e1e2" 
        stroke="#2c3338" 
        strokeWidth="2"
      />
      
      <line 
        x1="6.5" 
        y1="55" 
        x2="36.5" 
        y2="44.8" 
        stroke="white" 
        strokeWidth="5" 
        opacity="0.95"
      />
      
      <path d="M36.5,44.8 L70.5,40.8" stroke="#FF0000" strokeWidth="3" />
      <path d="M36.5,44.8 L71.2,42.8" stroke="#FF7F00" strokeWidth="3" />
      <path d="M36.5,44.8 L72.0,44.8" stroke="#FFFF00" strokeWidth="3" />
      <path d="M36.5,44.8 L72.8,46.8" stroke="#00FF00" strokeWidth="3" />
      <path d="M36.5,44.8 L73.5,48.8" stroke="#0000FF" strokeWidth="3" />
      <path d="M36.5,44.8 L74.2,50.8" stroke="#8B00FF" strokeWidth="3" />
      
      <path d="M70.5,40.8 L93.5,48" stroke="#FF0000" strokeWidth="4.5" />
      <path d="M71.2,42.8 L93.5,53" stroke="#FF7F00" strokeWidth="4.5" />
      <path d="M72.0,44.8 L93.5,58" stroke="#FFFF00" strokeWidth="4.5" />
      <path d="M72.8,46.8 L93.5,63" stroke="#00FF00" strokeWidth="4.5" />
      <path d="M73.5,48.8 L93.5,68" stroke="#0000FF" strokeWidth="4.5" />
      <path d="M74.2,50.8 L93.5,73" stroke="#8B00FF" strokeWidth="4.5" />
    </svg>
  );
}
