import { INSTRUCTIONS } from '../constants/instructions';
import { RANKING } from '../constants/ranking';
import { GlobalStyle } from '../constants/theme';
import Image from '../models/image';

describe('frontend smoke invariants', () => {
  it('keeps the tutorial instructions map complete for every guided screen', () => {
    expect(INSTRUCTIONS.Tutorial).toEqual(
      expect.objectContaining({
        HomeScreen: expect.any(String),
        HomeScreenModalBtn: expect.objectContaining({
          hide: expect.any(String),
          guess: expect.any(String),
          finish: expect.any(String),
        }),
        HidingPathScreen: expect.any(String),
        HideScreen: expect.any(String),
        SetInstructionScreen: expect.any(String),
        GuessPathScreen: expect.any(String),
        GuessScreen: expect.any(String),
        ShowSuccess: expect.any(String),
        ShowFailure: expect.any(String),
      })
    );
  });

  it('keeps ranking headers and theme tokens available to the UI', () => {
    expect(RANKING.tableHeaders).toEqual([
      'Rank',
      'Name',
      'Score',
      'Max Streak',
      'Guess Score',
      'Guess Count',
      'Hide Score',
      'Hide Count',
    ]);
    expect(GlobalStyle.color).toEqual(
      expect.objectContaining({
        primaryColor500: expect.any(String),
        secondaryColor: expect.any(String),
        tertiaryColor: expect.any(String),
        error500: expect.any(String),
      })
    );
  });

  it('builds image models with the expected public field shape', () => {
    expect(
      new Image(
        'file:///waldo.jpg',
        'image-1',
        'Find the goose',
        1200,
        800,
        true,
        { x: 0.4, y: 0.6 },
        640,
        320,
        9
      )
    ).toEqual({
      imageFile: 'file:///waldo.jpg',
      pictureId: 'image-1',
      description: 'Find the goose',
      imageHeight: 1200,
      imageWidth: 800,
      isPortrait: true,
      touchLocation: { x: 0.4, y: 0.6 },
      screenHeight: 640,
      screenWidth: 320,
      listId: 9,
    });
  });
});