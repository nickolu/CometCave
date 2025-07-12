'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Swords, MapPin, Shield, AlertTriangle, FileText, RotateCcw } from 'lucide-react';

interface BattleScenario {
  setting: string;
  rules: string;
  obstacles: string;
  limitations: string;
  additionalContext: string;
}

// Simple card components (reusing from step02)
const SimpleCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`rounded-lg border shadow-sm ${className}`}>{children}</div>;

const SimpleCardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col space-y-1.5 p-6">{children}</div>
);

const SimpleCardTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xl font-semibold leading-none tracking-tight">{children}</div>
);

const SimpleCardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 pt-0">{children}</div>
);

export function Step03DefineScenario({
  candidate1Name,
  candidate2Name,
  battleScenario,
  updateBattleScenario,
  onNext,
  onPrevious,
}: {
  candidate1Name: string;
  candidate2Name: string;
  battleScenario: BattleScenario;
  updateBattleScenario: (field: keyof BattleScenario, value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const resetToDefaults = () => {
    updateBattleScenario('setting', 'Open field with no obstacles');
    updateBattleScenario(
      'rules',
      'Standard combat, fight until one character is knocked out or unable to continue'
    );
    updateBattleScenario('obstacles', '');
    updateBattleScenario('limitations', '');
    updateBattleScenario(
      'additionalContext',
      'Both characters are at peak abilities from their respective canon'
    );
  };

  const hasCustomScenario =
    battleScenario.setting ||
    battleScenario.rules ||
    battleScenario.obstacles ||
    battleScenario.limitations ||
    battleScenario.additionalContext;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-cream-white mb-2">Define the Battle Scenario</h2>
        <p className="text-gray-300 mb-4">
          Customize the battle conditions for{' '}
          <span className="text-space-purple font-semibold">{candidate1Name}</span> vs{' '}
          <span className="text-space-purple font-semibold">{candidate2Name}</span>
        </p>
        <p className="text-sm text-gray-400">
          Leave fields empty to use default settings: Standard TKO battle in an open field with peak
          abilities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setting */}
        <SimpleCard className="bg-space-dark border-space-purple/30">
          <SimpleCardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-space-purple" />
              <SimpleCardTitle>
                <span className="text-cream-white">Battle Setting</span>
              </SimpleCardTitle>
            </div>
          </SimpleCardHeader>
          <SimpleCardContent>
            <Textarea
              value={battleScenario.setting}
              onChange={e => updateBattleScenario('setting', e.target.value)}
              placeholder="Describe the location and environment where the battle takes place..."
              className="bg-space-dark border-space-purple/30 text-cream-white min-h-[100px]"
            />
            <p className="text-xs text-gray-400 mt-2">Default: Open field with no obstacles</p>
          </SimpleCardContent>
        </SimpleCard>

        {/* Rules */}
        <SimpleCard className="bg-space-dark border-space-purple/30">
          <SimpleCardHeader>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-space-purple" />
              <SimpleCardTitle>
                <span className="text-cream-white">Battle Rules</span>
              </SimpleCardTitle>
            </div>
          </SimpleCardHeader>
          <SimpleCardContent>
            <Textarea
              value={battleScenario.rules}
              onChange={e => updateBattleScenario('rules', e.target.value)}
              placeholder="Define the victory conditions and combat rules..."
              className="bg-space-dark border-space-purple/30 text-cream-white min-h-[100px]"
            />
            <p className="text-xs text-gray-400 mt-2">
              Default: Fight until one character is knocked out or unable to continue
            </p>
          </SimpleCardContent>
        </SimpleCard>

        {/* Obstacles */}
        <SimpleCard className="bg-space-dark border-space-purple/30">
          <SimpleCardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-space-purple" />
              <SimpleCardTitle>
                <span className="text-cream-white">Obstacles & Hazards</span>
              </SimpleCardTitle>
            </div>
          </SimpleCardHeader>
          <SimpleCardContent>
            <Textarea
              value={battleScenario.obstacles}
              onChange={e => updateBattleScenario('obstacles', e.target.value)}
              placeholder="Describe any environmental hazards, traps, or obstacles..."
              className="bg-space-dark border-space-purple/30 text-cream-white min-h-[100px]"
            />
            <p className="text-xs text-gray-400 mt-2">Default: No obstacles or hazards</p>
          </SimpleCardContent>
        </SimpleCard>

        {/* Limitations */}
        <SimpleCard className="bg-space-dark border-space-purple/30">
          <SimpleCardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-space-purple" />
              <SimpleCardTitle>
                <span className="text-cream-white">Limitations & Restrictions</span>
              </SimpleCardTitle>
            </div>
          </SimpleCardHeader>
          <SimpleCardContent>
            <Textarea
              value={battleScenario.limitations}
              onChange={e => updateBattleScenario('limitations', e.target.value)}
              placeholder="Any power restrictions, equipment limitations, or special conditions..."
              className="bg-space-dark border-space-purple/30 text-cream-white min-h-[100px]"
            />
            <p className="text-xs text-gray-400 mt-2">
              Default: No limitations, characters at peak abilities
            </p>
          </SimpleCardContent>
        </SimpleCard>
      </div>

      {/* Additional Context */}
      <SimpleCard className="bg-space-dark border-space-purple/30">
        <SimpleCardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-space-purple" />
            <SimpleCardTitle>
              <span className="text-cream-white">Additional Context</span>
            </SimpleCardTitle>
          </div>
        </SimpleCardHeader>
        <SimpleCardContent>
          <Textarea
            value={battleScenario.additionalContext}
            onChange={e => updateBattleScenario('additionalContext', e.target.value)}
            placeholder="Any other important details, motivations, or special circumstances..."
            className="bg-space-dark border-space-purple/30 text-cream-white min-h-[120px]"
          />
          <p className="text-xs text-gray-400 mt-2">
            Default: Both characters are at peak abilities from their respective canon
          </p>
        </SimpleCardContent>
      </SimpleCard>

      {/* Preview */}
      {hasCustomScenario && (
        <SimpleCard className="bg-space-grey/20 border-space-purple/20">
          <SimpleCardHeader>
            <SimpleCardTitle>
              <span className="text-cream-white">Scenario Preview</span>
            </SimpleCardTitle>
          </SimpleCardHeader>
          <SimpleCardContent>
            <div className="text-sm text-gray-300 whitespace-pre-line">
              <strong className="text-space-purple">
                {candidate1Name} vs {candidate2Name}
              </strong>
              {battleScenario.setting && (
                <>
                  <br />
                  <br />
                  <strong>Setting:</strong> {battleScenario.setting}
                </>
              )}
              {battleScenario.rules && (
                <>
                  <br />
                  <br />
                  <strong>Rules:</strong> {battleScenario.rules}
                </>
              )}
              {battleScenario.obstacles && (
                <>
                  <br />
                  <br />
                  <strong>Obstacles:</strong> {battleScenario.obstacles}
                </>
              )}
              {battleScenario.limitations && (
                <>
                  <br />
                  <br />
                  <strong>Limitations:</strong> {battleScenario.limitations}
                </>
              )}
              {battleScenario.additionalContext && (
                <>
                  <br />
                  <br />
                  <strong>Additional Context:</strong> {battleScenario.additionalContext}
                </>
              )}
            </div>
          </SimpleCardContent>
        </SimpleCard>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
        >
          Previous
        </Button>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={resetToDefaults}
            className="text-gray-400 hover:text-cream-white hover:bg-space-purple/20"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>

          <Button
            onClick={onNext}
            className="bg-space-purple text-cream-white hover:bg-space-purple/90"
          >
            Generate Battle Results
          </Button>
        </div>
      </div>
    </div>
  );
}
