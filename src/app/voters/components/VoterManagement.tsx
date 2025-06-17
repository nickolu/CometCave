'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Trash2, Copy, Users, Settings, Pencil, Sparkles } from 'lucide-react';
import { Voter } from '@/app/voters/types/voting';
import { useGenerateRandomVoter } from '../api/hooks';

const models = [
  { label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
  { label: 'gpt-4-turbo', value: 'gpt-4-turbo' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'gpt-4o', value: 'gpt-4o' },
];

interface VoterManagementProps {
  voters: Voter[];
  onVotersChange: (voters: Voter[]) => void;
  onNext: () => void;
}

export default function VoterManagement({ voters, onVotersChange, onNext }: VoterManagementProps) {
  const [newVoter, setNewVoter] = useState<Omit<Voter, 'id'>>({
    name: '',
    description: '',
    count: 10,
    modelConfig: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 150,
    },
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingVoterId, setEditingVoterId] = useState<string | null>(null);
  const [editedVoter, setEditedVoter] = useState<Voter | null>(null);

  const generateRandomVoterMutation = useGenerateRandomVoter();

  useEffect(() => {
    if (editingVoterId) {
      const voter = voters.find(v => v.id === editingVoterId);
      if (voter) {
        setEditedVoter({ ...voter });
      }
    } else {
      setEditedVoter(null);
    }
  }, [editingVoterId, voters]);

  const addVoter = () => {
    if (newVoter.name && newVoter.description) {
      const voter: Voter = {
        ...newVoter,
        id: Date.now().toString(),
      };
      onVotersChange([...voters, voter]);
      // Keep the form fields populated for easy creation of similar voters
      // Only clear the name to avoid duplicate names
      setNewVoter({
        ...newVoter,
        name: '',
      });
    }
  };

  const removeVoter = (id: string) => {
    onVotersChange(voters.filter(v => v.id !== id));
  };

  const duplicateVoter = (voter: Voter) => {
    const duplicate: Voter = {
      ...voter,
      id: Date.now().toString(),
      name: `${voter.name} (Copy)`,
    };
    onVotersChange([...voters, duplicate]);
  };

  const updateVoterCount = (id: string, count: number) => {
    onVotersChange(voters.map(v => (v.id === id ? { ...v, count } : v)));
  };

  const updateVoter = (updatedVoter: Voter) => {
    onVotersChange(voters.map(v => (v.id === updatedVoter.id ? updatedVoter : v)));
    setEditingVoterId(null);
  };

  const handleGenerateRandomVoter = () => {
    generateRandomVoterMutation.mutate(voters, {
      onSuccess: data => {
        onVotersChange([...voters, data.voter]);
      },
      onError: error => {
        console.error('Error generating random voter:', error);
        // You could add a toast notification here
      },
    });
  };

  const totalVoters = voters.reduce((sum, voter) => sum + voter.count, 0);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-cream-white">Manage Voters</h2>
        <p className="text-slate-400">
          Add different types of voters with their characteristics and AI model settings
        </p>
      </div>

      {/* Add New Voter */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-cream-white">Add New Voter Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="name" className="text-slate-400">
              Voter Name
            </Label>
            <Input
              id="name"
              value={newVoter.name}
              onChange={e => setNewVoter({ ...newVoter, name: e.target.value })}
              placeholder="e.g., Dog Lover, Cat Enthusiast"
              className="bg-slate-800 border-slate-700 text-cream-white mt-1"
            />
          </div>
          <div>
            <Label htmlFor="count" className="text-slate-400">
              Number of Voters
            </Label>
            <Input
              id="count"
              type="number"
              min="1"
              value={newVoter.count}
              onChange={e =>
                setNewVoter({ ...newVoter, count: Number.parseInt(e.target.value) || 10 })
              }
              className="bg-slate-800 border-slate-700 text-cream-white mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description" className="text-slate-400">
            Description
          </Label>
          <Textarea
            id="description"
            value={newVoter.description}
            onChange={e => setNewVoter({ ...newVoter, description: e.target.value })}
            placeholder="Describe this voter's characteristics, preferences, and background..."
            rows={3}
            className="bg-slate-800 border-slate-700 text-cream-white mt-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Advanced Settings
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 p-4 border border-slate-700 rounded-lg bg-slate-900/50">
            <div>
              <Label className="text-slate-400">Model</Label>
              <Select
                value={newVoter.modelConfig.model}
                onValueChange={value =>
                  setNewVoter({
                    ...newVoter,
                    modelConfig: { ...newVoter.modelConfig, model: value },
                  })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-cream-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-space-dark border-slate-700 text-cream-white">
                  {models.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-400">
                Temperature: {newVoter.modelConfig.temperature}
              </Label>
              <Slider
                value={[newVoter.modelConfig.temperature]}
                onValueChange={([value]) =>
                  setNewVoter({
                    ...newVoter,
                    modelConfig: { ...newVoter.modelConfig, temperature: value },
                  })
                }
                min={0}
                max={2}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="text-slate-400">Max Tokens</Label>
              <Input
                type="number"
                value={newVoter.modelConfig.maxTokens}
                onChange={e =>
                  setNewVoter({
                    ...newVoter,
                    modelConfig: {
                      ...newVoter.modelConfig,
                      maxTokens: Number.parseInt(e.target.value) || 150,
                    },
                  })
                }
                min={50}
                max={500}
                className="bg-slate-800 border-slate-700 text-cream-white mt-1"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={addVoter}
            className="flex-1 bg-space-purple text-cream-white hover:bg-space-purple/90"
          >
            Add Voter Type
          </Button>
          <Button
            onClick={handleGenerateRandomVoter}
            disabled={generateRandomVoterMutation.isPending}
            variant="outline"
            className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
            title="Generate a random voter with AI-created characteristics"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generateRandomVoterMutation.isPending ? 'Generating...' : 'Random'}
          </Button>
        </div>
      </div>

      {/* Voter Pool Visualization */}
      {voters.length > 0 && (
        <div className="space-y-6 pt-8">
          <h3 className="flex items-center gap-2 text-xl font-bold text-cream-white">
            <Users className="w-5 h-5" />
            Voter Pool ({totalVoters} total voters)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {voters.map(voter => (
              <div
                key={voter.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4 flex flex-col"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-semibold text-cream-white">{voter.name}</h4>
                    <span className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 rounded-full w-fit">
                      {voter.modelConfig.model}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingVoterId(voter.id)}
                      className="text-slate-400 hover:text-cream-white hover:bg-slate-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateVoter(voter)}
                      className="text-slate-400 hover:text-cream-white hover:bg-slate-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVoter(voter.id)}
                      className="text-slate-400 hover:text-cream-white hover:bg-slate-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-slate-400 flex-grow">{voter.description}</p>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700">
                  <Label className="text-xs text-slate-400">Count:</Label>
                  <Input
                    type="number"
                    min="1"
                    value={voter.count}
                    onChange={e =>
                      updateVoterCount(voter.id, Number.parseInt(e.target.value) || 10)
                    }
                    className="bg-slate-900 border-slate-600 text-cream-white w-20 h-8 text-center"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <span className="text-lg font-semibold text-cream-white">Total Voters: {totalVoters}</span>
        <Button
          onClick={onNext}
          disabled={voters.length === 0}
          className="bg-space-purple text-cream-white hover:bg-space-purple/90"
        >
          Next: Set Criteria
        </Button>
      </div>

      {editingVoterId && editedVoter && (
        <EditVoterModal
          voter={editedVoter}
          onUpdate={updateVoter}
          onCancel={() => setEditingVoterId(null)}
          onRemove={removeVoter}
        />
      )}
    </div>
  );
}

interface EditVoterModalProps {
  voter: Voter;
  onUpdate: (voter: Voter) => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
}

function EditVoterModal({ voter, onUpdate, onCancel, onRemove }: EditVoterModalProps) {
  const [editedVoter, setEditedVoter] = useState(voter);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-space-dark rounded-2xl p-8 md:p-12 w-full max-w-2xl border border-space-purple/30 m-4">
        <h3 className="text-xl font-bold mb-4 text-cream-white">Edit Voter Type</h3>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name" className="text-slate-400">
                Voter Name
              </Label>
              <Input
                id="edit-name"
                value={editedVoter.name}
                onChange={e => setEditedVoter({ ...editedVoter, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-cream-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-count" className="text-slate-400">
                Number of Voters
              </Label>
              <Input
                id="edit-count"
                type="number"
                min="1"
                value={editedVoter.count}
                onChange={e =>
                  setEditedVoter({ ...editedVoter, count: Number.parseInt(e.target.value) || 10 })
                }
                className="bg-slate-800 border-slate-700 text-cream-white mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-description" className="text-slate-400">
              Description
            </Label>
            <Textarea
              id="edit-description"
              value={editedVoter.description}
              onChange={e => setEditedVoter({ ...editedVoter, description: e.target.value })}
              rows={3}
              className="bg-slate-800 border-slate-700 text-cream-white mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Advanced Settings
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 border border-slate-700 rounded-lg bg-slate-900/50">
              <div>
                <Label className="text-slate-400">Model</Label>
                <Select
                  value={editedVoter.modelConfig.model}
                  onValueChange={value =>
                    setEditedVoter({
                      ...editedVoter,
                      modelConfig: { ...editedVoter.modelConfig, model: value },
                    })
                  }
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-cream-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-space-dark border-slate-700 text-cream-white">
                    {models.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-400">
                  Temperature: {editedVoter.modelConfig.temperature}
                </Label>
                <Slider
                  value={[editedVoter.modelConfig.temperature]}
                  onValueChange={([value]) =>
                    setEditedVoter({
                      ...editedVoter,
                      modelConfig: { ...editedVoter.modelConfig, temperature: value },
                    })
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-slate-400">Max Tokens</Label>
                <Input
                  type="number"
                  value={editedVoter.modelConfig.maxTokens}
                  onChange={e =>
                    setEditedVoter({
                      ...editedVoter,
                      modelConfig: {
                        ...editedVoter.modelConfig,
                        maxTokens: Number.parseInt(e.target.value) || 150,
                      },
                    })
                  }
                  min={50}
                  max={500}
                  className="bg-slate-800 border-slate-700 text-cream-white mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8">
          <Button onClick={() => onRemove(voter.id)} variant="destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onUpdate(editedVoter)}
              className="bg-space-purple text-cream-white hover:bg-space-purple/90"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
