import { useState, ReactNode, Children } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

interface Step {
  title: string;
  description?: string;
}

interface MultiStepFormProps {
  steps: Step[];
  children: ReactNode[];
  onComplete: () => void;
  onCancel: () => void;
}

export function MultiStepForm({ steps, children, onComplete, onCancel }: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = steps.length;

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  // Получаем текущий шаг
  const currentStepContent = Children.toArray(children)[currentStep];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {steps[currentStep].title}
        </CardTitle>
        {steps[currentStep].description && (
          <p className="text-muted-foreground">
            {steps[currentStep].description}
          </p>
        )}
        <div className="mt-4">
          <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Шаг {currentStep + 1} из {totalSteps}</span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="py-4">
          {currentStepContent}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Отмена
        </Button>
        
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button 
              variant="outline" 
              onClick={prevStep}
            >
              Назад
            </Button>
          )}
          
          {isLastStep ? (
            <Button onClick={onComplete}>
              Завершить
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Далее
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}