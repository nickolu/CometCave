'use client';

import { useState } from 'react';
import { Button } from '@/app/voters/components/ui/button';
import { Progress } from '@/app/voters/components/ui/progress';
import { Play } from 'lucide-react';
import type { Voter, VotingCriteria, Vote } from '../../../types/voting';

interface VotingExecutionProps {
  voters: Voter[];
  criteria: VotingCriteria;
  onVotingComplete: (votes: Vote[]) => void;
  onBack: () => void;
}

export default function VotingExecution({
  voters,
  criteria,
  onVotingComplete,
  onBack,
}: VotingExecutionProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentVoter, setCurrentVoter] = useState('');
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalVoters = voters.reduce((sum, voter) => sum + voter.count, 0);

  const castVote = async (
    voter: Voter,
    criteria: VotingCriteria,
    instance: number
  ): Promise<Vote> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch('/api/v1/voters/cast-vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        voter,
        criteria,
        instance,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const executeVoting = async () => {
    setIsVoting(true);
    setProgress(0);
    setVotes([]);
    setError(null);

    const allVotes: Vote[] = [];
    let completedVotes = 0;
    const errors: string[] = [];

    try {
      // Test API key with a single request first
      await castVote(voters[0], criteria, 0);

      // If successful, proceed with all votes
      for (const voter of voters) {
        for (let i = 0; i < voter.count; i++) {
          setCurrentVoter(`${voter.name} #${i + 1}`);

          try {
            const vote = await castVote(voter, criteria, i);
            allVotes.push(vote);
            setVotes([...allVotes]);

            completedVotes++;
            setProgress((completedVotes / totalVoters) * 100);

            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error('Error casting vote:', error);
            errors.push(
              `${voter.name} #${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            // Continue with other votes even if one fails
            completedVotes++;
            setProgress((completedVotes / totalVoters) * 100);
          }
        }
      }

      if (errors.length > 0) {
        setError(`Completed with ${errors.length} errors. Some votes may be missing.`);
      }
    } catch (error) {
      console.error('Critical error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start voting process');
      setVotes([]);
    } finally {
      setIsVoting(false);
      setCurrentVoter('');
    }

    if (allVotes.length > 0) {
      onVotingComplete(allVotes);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Execute Voting</h2>
        <p className="text-gray-600">Run the AI voting simulation with your configured voters</p>
      </div>

      <div>
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-cream-white mb-4">
            Voting Summary
          </h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Voters</p>
              <p className="text-2xl font-bold">{totalVoters}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Voter Types</p>
              <p className="text-2xl font-bold">{voters.length}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Question</p>
            <p className="font-medium">{criteria.question}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Options</p>
            <ul className="space-y-1">
              {criteria.options.map((option, index) => (
                <li key={index} className="text-sm">
                  • {option}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-red-200 bg-red-50">
          <div className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <h4 className="font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isVoting && (
        <div>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-cream-white mb-4">
              Voting in Progress...
            </h2>
          </div>
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-gray-600">Currently voting: {currentVoter}</p>
            <p className="text-center text-sm">
              {Math.round(progress)}% complete ({votes.length}/{totalVoters} votes cast)
            </p>
          </div>
        </div>
      )}

      {votes.length > 0 && !isVoting && (
        <div>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-cream-white mb-4">
              Voting Complete!
            </h2>
          </div>
          <div className="space-y-4">
            <p className="text-center text-lg">
              Successfully collected {votes.length} votes from {totalVoters} voters
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isVoting}
          className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
        >
          Back: Voting Criteria
        </Button>

        <div className="flex gap-2">
          {!isVoting && votes.length === 0 && (
            <Button onClick={executeVoting} size="lg">
              <Play className="w-4 h-4 mr-2" />
              Start Voting
            </Button>
          )}

          {votes.length > 0 && !isVoting && (
            <Button onClick={() => onVotingComplete(votes)} size="lg">
              View Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
