import logoDdi from '../imports/logo_ddi.jpeg';

export function PartnerLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {/* Official DDI Logo image as provided */}
      <img
        src={logoDdi}
        alt="Digital Democracy Initiative"
        className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto"
        referrerPolicy="no-referrer"
      />

      {/* Digital Democracy Initiative below the logo */}
      <span
        className="mt-3 text-sm sm:text-base font-bold text-gray-900 tracking-wide text-center"
        style={{ fontFamily: '"Jost", sans-serif' }}
      >
        Digital Democracy Initiative
      </span>
    </div>
  );
}

export default PartnerLogo;
