import { useState, useRef, useCallback } from "react";

interface GameObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: string;
  health?: number;
}

export const useGameLogic = () => {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [currentWeapon, setCurrentWeapon] = useState("basic");
  const [weaponAmmo, setWeaponAmmo] = useState({ basic: Infinity, rapid: 100 });

  const playerRef = useRef<GameObject>({
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    radius: 15,
    color: "#ffffff",
    type: "player",
    health: 100,
  });

  const enemiesRef = useRef<GameObject[]>([]);
  const projectilesRef = useRef<GameObject[]>([]);
  const particlesRef = useRef<GameObject[]>([]);

  const initGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setCurrentWeapon("basic");
    setWeaponAmmo({ basic: Infinity, rapid: 100 });

    playerRef.current = {
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 15,
      color: "#ffffff",
      type: "player",
      health: 100,
    };

    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
  }, []);

  const updateGame = useCallback(() => {
    // Update player
    // Update enemies
    // Update projectiles
    // Handle collisions
    // Update score/level
  }, []);

  const handleGameOver = useCallback(() => {
    console.log("Game Over! Final Score:", score);
  }, [score]);

  return {
    score,
    level,
    lives,
    currentWeapon,
    weaponAmmo,
    gameObjects: {
      player: playerRef,
      enemies: enemiesRef,
      projectiles: projectilesRef,
      particles: particlesRef,
    },
    initGame,
    updateGame,
    handleGameOver,
  };
};
