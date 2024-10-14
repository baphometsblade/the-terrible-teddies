import { useEffect, useCallback } from 'react';
import { Howl } from 'howler';

const sounds = {
  attack: '/sounds/attack.mp3',
  defend: '/sounds/defend.mp3',
  special: '/sounds/special.mp3',
  powerUp: '/sounds/powerup.mp3',
  combo: '/sounds/combo.mp3',
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3',
  weatherChange: '/sounds/weather_change.mp3',
  backgroundMusic: '/sounds/background_music.mp3',
};

export const useSound = () => {
  useEffect(() => {
    const backgroundMusic = new Howl({
      src: [sounds.backgroundMusic],
      loop: true,
      volume: 0.5,
    });
    backgroundMusic.play();

    return () => {
      backgroundMusic.stop();
    };
  }, []);

  const playSound = useCallback((soundName) => {
    if (sounds[soundName]) {
      const sound = new Howl({
        src: [sounds[soundName]],
        volume: 0.7,
      });
      sound.play();
    }
  }, []);

  return { playSound };
};