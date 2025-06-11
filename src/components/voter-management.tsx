'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Trash2, Copy, Users, Settings, Pencil } from 'lucide-react';
import { Voter } from '@/types/voting';

interface VoterManagementProps {
  voters: Voter[];
  onVotersChange: (voters: Voter[]) => void;
  onNext: () => void;
}

export default function VoterManagement({ voters, onVotersChange, onNext }: VoterManagementProps) {
  const [newVoter, setNewVoter] = useState<Omit<Voter, 'id'>>({
    name: '',
    description: '',
    count: 1,
    modelConfig: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 150,
    },
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingVoterId, setEditingVoterId] = useState<string | null>(null);
  const [editedVoter, setEditedVoter] = useState<Voter | null>(null);
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false);

  useEffect(() => {
    if (editingVoterId) {
      const voter = voters.find(v => v.id === editingVoterId);
      if (voter) {
        setEditedVoter({ ...voter });
      }
    } else {
      setEditedVoter(null);
      setShowAdvancedEdit(false);
    }
  }, [editingVoterId, voters]);

  const addVoter = () => {
    if (newVoter.name && newVoter.description) {
      const voter: Voter = {
        ...newVoter,
        id: Date.now().toString(),
      };
      onVotersChange([...voters, voter]);
      setNewVoter({
        name: '',
        description: '',
        count: 1,
        modelConfig: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 150,
        },
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

  const totalVoters = voters.reduce((sum, voter) => sum + voter.count, 0);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Manage Voters</h2>
        <p className="text-gray-600">
          Add different types of voters with their characteristics and AI model settings
        </p>
      </div>

      {/* Add New Voter */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Voter Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Voter Name</Label>
              <Input
                id="name"
                value={newVoter.name}
                onChange={e => setNewVoter({ ...newVoter, name: e.target.value })}
                placeholder="e.g., Dog Lover, Cat Enthusiast"
              />
            </div>
            <div>
              <Label htmlFor="count">Number of Voters</Label>
              <Input
                id="count"
                type="number"
                min="1"
                value={newVoter.count}
                onChange={e =>
                  setNewVoter({ ...newVoter, count: Number.parseInt(e.target.value) || 1 })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newVoter.description}
              onChange={e => setNewVoter({ ...newVoter, description: e.target.value })}
              placeholder="Describe this voter's characteristics, preferences, and background..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Settings className="w-4 h-4 mr-2" />
              Advanced Settings
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <div>
                <Label>Model</Label>
                <Select
                  value={newVoter.modelConfig.model}
                  onValueChange={value =>
                    setNewVoter({
                      ...newVoter,
                      modelConfig: { ...newVoter.modelConfig, model: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Temperature: {newVoter.modelConfig.temperature}</Label>
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
                <Label>Max Tokens</Label>
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
                />
              </div>
            </div>
          )}

          <Button onClick={addVoter} className="w-full">
            Add Voter Type
          </Button>
        </CardContent>
      </Card>

      {/* Voter Pool Visualization */}
      {voters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Voter Pool ({totalVoters} total voters)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {voters.map(voter => (
                <div key={voter.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold">{voter.name}</h4>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingVoterId(voter.id)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicateVoter(voter)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeVoter(voter.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">{voter.description}</p>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Count:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={voter.count}
                      onChange={e =>
                        updateVoterCount(voter.id, Number.parseInt(e.target.value) || 1)
                      }
                      className="w-20 h-8"
                    />
                  </div>

                  <div className="text-xs text-gray-500">
                    Model: {voter.modelConfig.model} | Temp: {voter.modelConfig.temperature}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {voters.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onNext} size="lg">
            Next: Set Voting Criteria
          </Button>
        </div>
      )}

      {editingVoterId && editedVoter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Voter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Voter Name</Label>
                  <Input
                    id="edit-name"
                    value={editedVoter.name}
                    onChange={e => setEditedVoter({ ...editedVoter, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-count">Number of Voters</Label>
                  <Input
                    id="edit-count"
                    type="number"
                    min="1"
                    value={editedVoter.count}
                    onChange={e =>
                      setEditedVoter({
                        ...editedVoter,
                        count: Number.parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editedVoter.description}
                  onChange={e => setEditedVoter({ ...editedVoter, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedEdit(!showAdvancedEdit)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Advanced Settings
                </Button>
              </div>

              {showAdvancedEdit && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div>
                    <Label>Model</Label>
                    <Select
                      value={editedVoter.modelConfig.model}
                      onValueChange={value =>
                        setEditedVoter({
                          ...editedVoter,
                          modelConfig: { ...editedVoter.modelConfig, model: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Temperature: {editedVoter.modelConfig.temperature}</Label>
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
                    <Label>Max Tokens</Label>
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
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setEditingVoterId(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updateVoter(editedVoter)}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
