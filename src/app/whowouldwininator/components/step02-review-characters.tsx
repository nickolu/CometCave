'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Loader2, Edit2, Save } from 'lucide-react';
import Image from 'next/image';
import { isImageGenerationAllowedClient, getImageGenerationDisableReasonClient } from '@/lib/utils';

interface CharacterStats {
  strength: number;
  speed: number;
  durability: number;
  intelligence: number;
  specialAbilities: number;
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
  const [imageGenerationAllowed, setImageGenerationAllowed] = useState(true);
  const [disableReason, setDisableReason] = useState('');

  // Check if image generation is allowed
  useEffect(() => {
    isImageGenerationAllowedClient().then(setImageGenerationAllowed);
    getImageGenerationDisableReasonClient().then(setDisableReason);
  }, []);
  const [editingFields, setEditingFields] = useState<{
    candidate1: Set<keyof CharacterDetails>;
    candidate2: Set<keyof CharacterDetails>;
  }>({
    candidate1: new Set(),
    candidate2: new Set(),
  });

  const [expandedBackstories, setExpandedBackstories] = useState<{
    candidate1: boolean;
    candidate2: boolean;
  }>({
    candidate1: false,
    candidate2: false,
  });

  // Track generation initiation to prevent duplicates
  const generationInitiated = useRef<{
    candidate1: Set<keyof CharacterDetails>;
    candidate2: Set<keyof CharacterDetails>;
  }>({
    candidate1: new Set(),
    candidate2: new Set(),
  });

  // Auto-generate character details when component mounts (excluding portrait)
  useEffect(() => {
    if (candidate1Name && candidate1Description) {
      const detailTypes: Array<keyof CharacterDetails> = ['backstory', 'powers', 'stats', 'feats'];

      detailTypes.forEach(detailType => {
        if (!generationInitiated.current.candidate1.has(detailType)) {
          generationInitiated.current.candidate1.add(detailType);
          generateCharacterDetail(1, detailType, candidate1Name, candidate1Description);
        }
      });
    } else {
      // Reset generation tracking when character changes
      generationInitiated.current.candidate1.clear();
    }
  }, [candidate1Name, candidate1Description, generateCharacterDetail]);

  useEffect(() => {
    if (candidate2Name && candidate2Description) {
      const detailTypes: Array<keyof CharacterDetails> = ['backstory', 'powers', 'stats', 'feats'];

      detailTypes.forEach(detailType => {
        if (!generationInitiated.current.candidate2.has(detailType)) {
          generationInitiated.current.candidate2.add(detailType);
          generateCharacterDetail(2, detailType, candidate2Name, candidate2Description);
        }
      });
    } else {
      // Reset generation tracking when character changes
      generationInitiated.current.candidate2.clear();
    }
  }, [candidate2Name, candidate2Description, generateCharacterDetail]);

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

  const toggleBackstoryExpansion = (candidateNumber: 1 | 2) => {
    const candidateKey = candidateNumber === 1 ? 'candidate1' : 'candidate2';
    setExpandedBackstories(prev => ({
      ...prev,
      [candidateKey]: !prev[candidateKey],
    }));
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleGeneratePortrait = (candidateNumber: 1 | 2) => {
    const name = candidateNumber === 1 ? candidate1Name : candidate2Name;
    const description = candidateNumber === 1 ? candidate1Description : candidate2Description;

    if (!generationInitiated.current[`candidate${candidateNumber}`].has('portrait')) {
      generationInitiated.current[`candidate${candidateNumber}`].add('portrait');
      generateCharacterDetail(candidateNumber, 'portrait', name, description);
    }
  };

  const StatBar = ({ label, value, max = 100 }: { label: string; value: number; max?: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium w-20">{label}:</span>
      <Progress value={(value / max) * 100} className="flex-1 text-space-purple" />
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
          {imageGenerationAllowed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-cream-white">Portrait</h3>
                {!details.portrait && !loading.portrait && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGeneratePortrait(candidateNumber)}
                    className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                  >
                    Generate Portrait
                  </Button>
                )}
              </div>
              {loading.portrait ? (
                <div className="flex items-center justify-center h-48 bg-space-grey/20 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-space-purple" />
                </div>
              ) : details.portrait ? (
                <Image
                  src={details.portrait.imageUrl}
                  alt={details.portrait.altText}
                  className="w-full object-cover rounded-lg"
                  width={1024}
                  height={1024}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-space-grey/20 rounded-lg gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleGeneratePortrait(candidateNumber)}
                    className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                  >
                    Generate Portrait
                  </Button>
                </div>
              )}
            </div>
          )}

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
              <div>
                <p className="text-sm text-gray-300">
                  {details.backstory
                    ? expandedBackstories[candidateKey]
                      ? details.backstory
                      : truncateText(details.backstory)
                    : 'No backstory available'}
                </p>
                {details.backstory && details.backstory.length > 150 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleBackstoryExpansion(candidateNumber)}
                    className="mt-2 text-space-purple hover:text-space-purple/80 p-0 h-auto"
                  >
                    {expandedBackstories[candidateKey] ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>
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
                    className="px-2 py-1 bg-space-purple/20 text-purple-200 rounded-md text-sm"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleEdit(candidateNumber, 'stats')}
              >
                {isEditing('stats') ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </Button>
            </div>
            {loading.stats ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-space-purple" />
                <span className="text-sm text-gray-400">Generating stats...</span>
              </div>
            ) : isEditing('stats') ? (
              <div className="space-y-4">
                {details.stats ? (
                  Object.entries(details.stats).map(([statName, statValue]) => (
                    <div key={statName} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-cream-white capitalize">
                          {statName}
                        </label>
                        <span className="text-sm text-gray-300">{statValue}</span>
                      </div>
                      <Slider
                        value={[statValue]}
                        onValueChange={([newValue]) => {
                          const updatedStats = {
                            ...details.stats,
                            [statName]: newValue,
                          } as CharacterStats;
                          updateCharacterDetail(candidateNumber, 'stats', updatedStats);
                        }}
                        max={100}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  ))
                ) : (
                  <span className="text-gray-400">No stats available to edit</span>
                )}
              </div>
            ) : details.stats ? (
              <div className="space-y-2">
                <StatBar label="Strength" value={details.stats.strength} />
                <StatBar label="Speed" value={details.stats.speed} />
                <StatBar label="Durability" value={details.stats.durability} />
                <StatBar label="Intelligence" value={details.stats.intelligence} />
                <StatBar label="Special Abilities" value={details.stats.specialAbilities} />
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
        <h2 className="text-2xl font-bold text-gray-400 mb-2 mt-6">Review Your Characters</h2>
        <p className="text-gray-300">
          Character details are being generated. You can edit any field by clicking the edit button.
        </p>
      </div>

      {/* Image Generation Disabled Alert */}
      {!imageGenerationAllowed && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-300 mb-1">
                Portrait Generation Disabled
              </h3>
              <p className="text-sm text-blue-200">{disableReason}</p>
            </div>
          </div>
        </div>
      )}

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
