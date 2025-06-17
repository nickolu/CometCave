'use client';

import { useState, useEffect } from 'react';
import VoterManagement from './components/VoterManagement';
import VotingCriteriaComponent from './components/VotingCriteria';
import VotingExecution from './components/VotingExecution';
import VotingResults from './components/VotingResults';
import { Voter, VotingCriteria, Vote } from '@/types/voting';

type Step = 'voters' | 'criteria' | 'voting' | 'results';

const VOTERS_STORAGE_KEY = 'voters-app-voters';

export default function VotingSimulation() {
  const [currentStep, setCurrentStep] = useState<Step>('voters');
  const [voters, setVoters] = useState<Voter[]>([]);
  const [criteria, setCriteria] = useState<VotingCriteria>({
    question: '',
    options: [],
  });
  const [votes, setVotes] = useState<Vote[]>([]);

  // Load voters from local storage on component mount
  useEffect(() => {
    try {
      const savedVoters = localStorage.getItem(VOTERS_STORAGE_KEY);
      if (savedVoters) {
        const parsedVoters = JSON.parse(savedVoters);
        if (Array.isArray(parsedVoters)) {
          setVoters(parsedVoters);
        }
      }
    } catch (error) {
      console.error('Error loading voters from local storage:', error);
    }
  }, []);

  // Function to update voters in both state and local storage
  const handleVotersChange = (newVoters: Voter[]) => {
    setVoters(newVoters);
    try {
      localStorage.setItem(VOTERS_STORAGE_KEY, JSON.stringify(newVoters));
    } catch (error) {
      console.error('Error saving voters to local storage:', error);
    }
  };

  const handleVotingComplete = (completedVotes: Vote[]) => {
    setVotes(completedVotes);
    setCurrentStep('results');
  };

  // Modified restart function - only clears current session data, not stored voters
  const handleRestart = () => {
    setCurrentStep('voters');
    setCriteria({ question: '', options: [] });
    setVotes([]);
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4">
            {[
              { key: 'voters', label: 'Manage Voters' },
              { key: 'criteria', label: 'Set Criteria' },
              { key: 'voting', label: 'Execute Voting' },
              { key: 'results', label: 'View Results' },
            ].map((step, index) => (
              <div key={step.key} className={`flex items-center ${index < 3 ? 'flex-1' : ''}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.key
                      ? 'bg-space-purple text-cream-white'
                      : voters.length > 0 &&
                          (step.key === 'criteria' ||
                            (criteria.question && step.key === 'voting') ||
                            (votes.length > 0 && step.key === 'results'))
                        ? 'bg-space-blue text-cream-white'
                        : 'bg-space-dark text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block text-cream-white">
                  {step.label}
                </span>
                {index < 3 && <div className="flex-1 h-0.5 bg-space-dark mx-4 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-space-dark border border-space-purple/30 rounded-2xl p-8 md:p-12">
          {currentStep === 'voters' && (
            <VoterManagement
              voters={voters}
              onVotersChange={handleVotersChange}
              onNext={() => setCurrentStep('criteria')}
            />
          )}

          {currentStep === 'criteria' && (
            <VotingCriteriaComponent
              criteria={criteria}
              onCriteriaChange={setCriteria}
              onNext={() => setCurrentStep('voting')}
              onBack={() => setCurrentStep('voters')}
            />
          )}

          {currentStep === 'voting' && (
            <VotingExecution
              voters={voters}
              criteria={criteria}
              onVotingComplete={handleVotingComplete}
              onBack={() => setCurrentStep('criteria')}
            />
          )}

          {currentStep === 'results' && (
            <VotingResults
              votes={votes}
              voters={voters}
              criteria={criteria}
              onRestart={handleRestart}
            />
          )}
        </div>
      </div>
    </div>
  );
}
