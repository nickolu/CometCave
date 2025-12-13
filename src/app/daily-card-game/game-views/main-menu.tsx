import { useGameState } from '../useGameState';

export function MainMenuView() {
  const { setGamePhase } = useGameState();
  return (
    <div>
      <h1>Main Menu</h1>
      <button
        onClick={() => {
          setGamePhase('blindSelection');
        }}
      >
        Start Game
      </button>
    </div>
  );
}
