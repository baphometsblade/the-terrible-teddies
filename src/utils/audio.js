import { Howl } from 'howler';

const sounds = {
  playCard: new Howl({ src: ['/sounds/play_card.mp3'] }),
  error: new Howl({ src: ['/sounds/error.mp3'] }),
  victory: new Howl({ src: ['/sounds/victory.mp3'] }),
  defeat: new Howl({ src: ['/sounds/defeat.mp3'] }),
};

export const playSound = (soundName) => {
  if (sounds[soundName]) {
    sounds[soundName].play();
  }
};