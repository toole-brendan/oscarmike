import React from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExerciseType, ExerciseStatus, exerciseInfo } from '@shared/schema';
import { ChevronRight } from 'lucide-react';

interface ExerciseCardProps {
  type: ExerciseType;
  status: ExerciseStatus;
  bestResult?: string;
  className?: string;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  type,
  status,
  bestResult,
  className = '',
}) => {
  const [_, navigate] = useLocation();
  const info = exerciseInfo[type];
  
  const handleClick = () => {
    if (type === 'run') {
      navigate('/run');
    } else {
      navigate(`/exercise/${type}`);
    }
  };
  
  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="absolute top-2 right-2 bg-green-100 text-secondary">
            Completed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="absolute top-2 right-2 bg-yellow-100 text-yellow-700">
            In Progress
          </Badge>
        );
      case 'not_started':
      default:
        return (
          <Badge className="absolute top-2 right-2 bg-blue-100 text-blue-700">
            Not Started
          </Badge>
        );
    }
  };
  
  return (
    <Card 
      className={`exercise-card overflow-hidden transition duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1 ${className}`}
      onClick={handleClick}
    >
      <div className="relative h-40 bg-neutral-50">
        <img 
          className="w-full h-full object-contain" 
          src={info.image} 
          alt={`${info.title} exercise`} 
        />
        {getStatusBadge()}
      </div>
      
      <div className="p-4">
        <h4 className="font-semibold text-neutral-dark mb-1">{info.title}</h4>
        <p className="text-sm text-gray-500 mb-3">{info.description}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            {bestResult ? `Best: ${bestResult}` : 'No attempts yet'}
          </span>
          <ChevronRight className="h-5 w-5 text-primary" />
        </div>
      </div>
    </Card>
  );
};

export default ExerciseCard;
