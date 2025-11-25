import { Star } from 'lucide-react';
import type { Difficulty } from '../types';

export type DifficultyOption = { id: Difficulty; label: string; detail: string; stars: number };

type Props = {
  difficulty: Difficulty;
  options: DifficultyOption[];
  onChange: (value: Difficulty) => void;
};

const DifficultySelector = ({ difficulty, options, onChange }: Props) => (
  <div className="difficulty-card">
    <div className="difficulty-header">
      <span className="eyebrow">Difficolta</span>
      <div className="difficulty-stars">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Star
            key={`star-${idx}`}
            size={18}
            className={
              idx < (options.find((opt) => opt.id === difficulty)?.stars || 0)
                ? 'filled'
                : ''
            }
          />
        ))}
      </div>
    </div>
    <div className="difficulty-options">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`difficulty-option ${difficulty === option.id ? 'selected' : ''}`}
          onClick={() => onChange(option.id)}
        >
          <div className="option-top">
            <span className="option-label">{option.label}</span>
            <div className="option-stars">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Star
                  key={`${option.id}-star-${idx}`}
                  size={16}
                  className={idx < option.stars ? 'filled' : ''}
                />
              ))}
            </div>
          </div>
          <div className="option-detail">{option.detail}</div>
        </button>
      ))}
    </div>
  </div>
);

export default DifficultySelector;
