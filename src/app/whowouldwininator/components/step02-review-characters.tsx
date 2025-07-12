'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loader2, Edit2, Save } from 'lucide-react';
import { useState } from 'react';

interface CharacterStats {
  strength: number;
  speed: number;
  durability: number;
  intelligence: number;
  energy: number;
  fighting: number;
}

interface CharacterDetails {
  backstory: string;
  powers: string[];
  stats: CharacterStats;
  feats: string[];
  portrait: {
    imageUrl: string;
    altText: string;
    prompt: string;
  } | null;
}

interface CharacterDetailsLoading {
  backstory: boolean;
  powers: boolean;
  stats: boolean;
  feats: boolean;
  portrait: boolean;
}

// Simple card components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border shadow-sm ${className}`}>{children}</div>
);

const CardHeader = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;

const CardTitle = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>
    {children}
  </div>
);

const CardContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;

export function Step02ReviewCharacters({
  candidate1Name,
  candidate2Name,
  candidate1Description,
  candidate2Description,
  candidate1Details,
  candidate2Details,
  candidate1DetailsLoading,
  candidate2DetailsLoading,
  generateCharacterDetail,
  updateCharacterDetail,
  onNext,
  onPrevious,
}: {
  candidate1Name: string;
  candidate2Name: string;
  candidate1Description: string;
  candidate2Description: string;
  candidate1Details: Partial<CharacterDetails>;
  candidate2Details: Partial<CharacterDetails>;
  candidate1DetailsLoading: CharacterDetailsLoading;
  candidate2DetailsLoading: CharacterDetailsLoading;
  generateCharacterDetail: (
    candidateNumber: 1 | 2,
    detailType: keyof CharacterDetails,
    name: string,
    description: string
  ) => Promise<void>;
  updateCharacterDetail: (
    candidateNumber: 1 | 2,
    detailType: keyof CharacterDetails,
    value: CharacterDetails[keyof CharacterDetails]
  ) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const [editingFields, setEditingFields] = useState<{
    candidate1: Set<keyof CharacterDetails>;
    candidate2: Set<keyof CharacterDetails>;
  }>({
    candidate1: new Set(),
    candidate2: new Set(),
  });

  // Auto-generate character details when component mounts
  useEffect(() => {
    if (candidate1Name && candidate1Description) {
      generateCharacterDetail(1, 'backstory', candidate1Name, candidate1Description);
      generateCharacterDetail(1, 'powers', candidate1Name, candidate1Description);
      generateCharacterDetail(1, 'stats', candidate1Name, candidate1Description);
      generateCharacterDetail(1, 'feats', candidate1Name, candidate1Description);
      generateCharacterDetail(1, 'portrait', candidate1Name, candidate1Description);
    }
  }, [candidate1Name, candidate1Description]); // Only depend on name and description

  useEffect(() => {
    if (candidate2Name && candidate2Description) {
      generateCharacterDetail(2, 'backstory', candidate2Name, candidate2Description);
      generateCharacterDetail(2, 'powers', candidate2Name, candidate2Description);
      generateCharacterDetail(2, 'stats', candidate2Name, candidate2Description);
      generateCharacterDetail(2, 'feats', candidate2Name, candidate2Description);
      generateCharacterDetail(2, 'portrait', candidate2Name, candidate2Description);
    }
  }, [candidate2Name, candidate2Description]); // Only depend on name and description

  const toggleEdit = (candidateNumber: 1 | 2, field: keyof CharacterDetails) => {
    const candidateKey = candidateNumber === 1 ? 'candidate1' : 'candidate2';
    setEditingFields(prev => {
      const newSet = new Set(prev[candidateKey]);
      if (newSet.has(field)) {
        newSet.delete(field);
      } else {
        newSet.add(field);
      }
      return { ...prev, [candidateKey]: newSet };
    });
  };

  const StatBar = ({ label, value, max = 10 }: { label: string; value: number; max?: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium w-20">{label}:</span>
      <Progress value={(value / max) * 100} className="flex-1" />
      <span className="text-sm w-8">{value}</span>
    </div>
  );

  const CharacterCard = ({
    candidateNumber,
    name,
    description,
    details,
    loading,
  }: {
    candidateNumber: 1 | 2;
    name: string;
    description: string;
    details: Partial<CharacterDetails>;
    loading: CharacterDetailsLoading;
  }) => {
    const candidateKey = candidateNumber === 1 ? 'candidate1' : 'candidate2';
    const isEditing = (field: keyof CharacterDetails) => editingFields[candidateKey].has(field);

    return (
      <Card className="bg-space-dark border-space-purple/30">
        <CardHeader>
          <CardTitle className="text-2xl text-cream-white">{name}</CardTitle>
          <p className="text-sm text-gray-300">{description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Portrait */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-white">Portrait</h3>
            </div>
            {loading.portrait ? (
              <div className="flex items-center justify-center h-48 bg-space-grey/20 rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-space-purple" />
              </div>
            ) : details.portrait ? (
              <img
                src={details.portrait.imageUrl}
                alt={details.portrait.altText}
                className="w-full h-48 object-cover rounded-lg"
              />
            ) : (
              <div className="flex items-center justify-center h-48 bg-space-grey/20 rounded-lg">
                <span className="text-gray-400">Portrait not available</span>
              </div>
            )}
          </div>

          {/* Backstory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-white">Backstory</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleEdit(candidateNumber, 'backstory')}
              >
                {isEditing('backstory') ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <Edit2 className="w-4 h-4" />
                )}
              </Button>
            </div>
            {loading.backstory ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-space-purple" />
                <span className="text-sm text-gray-400">Generating backstory...</span>
              </div>
            ) : isEditing('backstory') ? (
              <Textarea
                value={details.backstory || ''}
                onChange={e => updateCharacterDetail(candidateNumber, 'backstory', e.target.value)}
                className="bg-space-dark border-space-purple/30"
                rows={4}
              />
            ) : (
              <p className="text-sm text-gray-300">
                {details.backstory || 'No backstory available'}
              </p>
            )}
          </div>

          {/* Powers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-white">Powers</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleEdit(candidateNumber, 'powers')}
              >
                {isEditing('powers') ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </Button>
            </div>
            {loading.powers ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-space-purple" />
                <span className="text-sm text-gray-400">Generating powers...</span>
              </div>
            ) : isEditing('powers') ? (
              <Textarea
                value={details.powers?.join('\n') || ''}
                onChange={e =>
                  updateCharacterDetail(
                    candidateNumber,
                    'powers',
                    e.target.value.split('\n').filter(p => p.trim())
                  )
                }
                className="bg-space-dark border-space-purple/30"
                rows={3}
                placeholder="Enter powers, one per line"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {details.powers?.map((power, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-space-purple/20 text-space-purple rounded-md text-sm"
                  >
                    {power}
                  </span>
                )) || <span className="text-gray-400">No powers available</span>}
              </div>
            )}
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-white">Combat Stats</h3>
            </div>
            {loading.stats ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-space-purple" />
                <span className="text-sm text-gray-400">Generating stats...</span>
              </div>
            ) : details.stats ? (
              <div className="space-y-2">
                <StatBar label="Strength" value={details.stats.strength} />
                <StatBar label="Speed" value={details.stats.speed} />
                <StatBar label="Durability" value={details.stats.durability} />
                <StatBar label="Intelligence" value={details.stats.intelligence} />
                <StatBar label="Energy" value={details.stats.energy} />
                <StatBar label="Fighting" value={details.stats.fighting} />
              </div>
            ) : (
              <span className="text-gray-400">No stats available</span>
            )}
          </div>

          {/* Feats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-cream-white">Notable Feats</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleEdit(candidateNumber, 'feats')}
              >
                {isEditing('feats') ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </Button>
            </div>
            {loading.feats ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-space-purple" />
                <span className="text-sm text-gray-400">Generating feats...</span>
              </div>
            ) : isEditing('feats') ? (
              <Textarea
                value={details.feats?.join('\n') || ''}
                onChange={e =>
                  updateCharacterDetail(
                    candidateNumber,
                    'feats',
                    e.target.value.split('\n').filter(f => f.trim())
                  )
                }
                className="bg-space-dark border-space-purple/30"
                rows={4}
                placeholder="Enter feats, one per line"
              />
            ) : (
              <ul className="space-y-1">
                {details.feats?.map((feat, index) => (
                  <li key={index} className="text-sm text-gray-300">
                    • {feat}
                  </li>
                )) || <span className="text-gray-400">No feats available</span>}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-cream-white mb-2">Review Your Characters</h2>
        <p className="text-gray-300">
          Character details are being generated. You can edit any field by clicking the edit button.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CharacterCard
          candidateNumber={1}
          name={candidate1Name}
          description={candidate1Description}
          details={candidate1Details}
          loading={candidate1DetailsLoading}
        />
        <CharacterCard
          candidateNumber={2}
          name={candidate2Name}
          description={candidate2Description}
          details={candidate2Details}
          loading={candidate2DetailsLoading}
        />
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
        >
          Previous
        </Button>
        <Button
          onClick={onNext}
          className="bg-space-purple text-cream-white hover:bg-space-purple/90"
        >
          Next: Define Scenario
        </Button>
      </div>
    </div>
  );
}
