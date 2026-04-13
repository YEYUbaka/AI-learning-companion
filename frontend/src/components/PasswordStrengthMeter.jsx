import { getPasswordStrength } from '../utils/passwordPolicy';

function PasswordStrengthMeter({ password }) {
  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="min-w-[60px] text-xs text-slate-500">密码强度</span>
        <div className="flex flex-1 gap-1">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                strength.bars.includes(bar) ? strength.bgClass : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <span className={`min-w-[32px] text-right text-xs font-medium ${strength.colorClass}`}>
          {strength.text}
        </span>
      </div>
      <p className="text-xs text-slate-500">{strength.hint}</p>
    </div>
  );
}

export default PasswordStrengthMeter;
