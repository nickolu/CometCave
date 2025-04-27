import { useCharacterCreation } from '../hooks/useCharacterCreation';

export default function CharacterCreation({ onComplete }: { onComplete: () => void }) {
  const { character, updateCharacter, completeCreation } = useCharacterCreation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeCreation();
    onComplete();
  };

  return (
    <form className="space-y-4 p-4" onSubmit={handleSubmit}>
      <input
        className="w-full p-2 border rounded"
        placeholder="Name"
        value={character.name || ''}
        onChange={e => updateCharacter({ name: e.target.value })}
        required
      />
      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
        Start Adventure
      </button>
    </form>
  );
}
