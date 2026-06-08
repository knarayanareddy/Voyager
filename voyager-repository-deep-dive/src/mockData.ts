import { Page, Block } from './types';

// Simple UUID generator for mock data
export const generateUuid = () => {
  return 'uuid-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
};

export const getMockPages = (): Page[] => {
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const todayId = `journal-${new Date().toISOString().split('T')[0]}`;

  const welcomePageId = 'page-welcome';
  const spenPageId = 'page-spen';
  const mediaPageId = 'page-media';

  const welcomeBlocks: Block[] = [
    {
      uuid: 'w-1',
      content: 'Welcome to **Voyager**! 🚀 This is an out-of-the-world, privacy-first, local-first knowledge base built for Android & iOS. It is modeled after the powerful outline mechanics of [[Logseq]] and simulated inside a premium Samsung Galaxy S23 Ultra frame.',
      children: [],
      parentUuid: undefined
    },
    {
      uuid: 'w-2',
      content: '### Core Editor Mechanics ⌨️',
      children: [
        {
          uuid: 'w-2-1',
          content: 'Double-click any block to enter edit mode. Press `Enter` to commit and create a new block.',
          children: [],
          parentUuid: 'w-2'
        },
        {
          uuid: 'w-2-2',
          content: 'Press `Tab` on your keyboard (or use the screen toolbar) to **indent** a block, creating a parent-child hierarchy.',
          children: [
            {
              uuid: 'w-2-2-1',
              content: 'Child blocks can be collapsed by clicking the bullet icon on their parent. This is extremely useful for organizing large notes!',
              children: [],
              parentUuid: 'w-2-2'
            }
          ],
          parentUuid: 'w-2'
        },
        {
          uuid: 'w-2-3',
          content: 'Press `Shift + Tab` to **outdent** a block and move it up the hierarchy.',
          children: [],
          parentUuid: 'w-2'
        }
      ],
      parentUuid: undefined
    },
    {
      uuid: 'w-3',
      content: '### Bidirectional Linking & Tags 🔗',
      children: [
        {
          uuid: 'w-3-1',
          content: 'Create links to other pages by typing double brackets like `[[S-Pen Studio 🖊️]]` or `[[Media Studio 📷]]`. Clicking a link navigates to that page.',
          children: [],
          parentUuid: 'w-3'
        },
        {
          uuid: 'w-3-2',
          content: '`Shift + Click` on any link to open that page in the **Right Sidebar**! This allows you to view and edit two pages side-by-side.',
          children: [],
          parentUuid: 'w-3'
        },
        {
          uuid: 'w-3-3',
          content: 'Use tags like #productivity or #notes to group information. Voyager automatically indexes links and tags to build a bidirectional #knowledge-graph!',
          children: [],
          parentUuid: 'w-3'
        }
      ],
      parentUuid: undefined
    },
    {
      uuid: 'w-4',
      content: '### Spaced Repetition (Flashcards) 🧠',
      children: [
        {
          uuid: 'w-4-1',
          content: 'Voyager supports a full-fledged flashcard system based on the famous **SM-2 Algorithm**. This is perfect for learning and memorization!',
          children: [],
          parentUuid: 'w-4'
        },
        {
          uuid: 'w-4-2',
          content: 'Simply add `#card` to any block to turn it into a flashcard. The front of the card is the block text, and the back is its child block(s). Try this card in the Flashcards view: #card',
          children: [
            {
              uuid: 'w-4-2-1',
              content: 'What is the default ease factor in the SM-2 algorithm? #card\n\n**2.5**. It increases or decreases based on how well you remember the card, dynamically scheduling reviews!',
              children: [],
              parentUuid: 'w-4-2'
            }
          ],
          parentUuid: 'w-4'
        }
      ],
      parentUuid: undefined
    },
    {
      uuid: 'w-5',
      content: '### Task Management 🎯',
      children: [
        {
          uuid: 'w-5-1',
          content: 'Click the checkbox icon on any block or type `/todo` to create a task. You can cycle through states: TODO ➡️ DOING ➡️ DONE!',
          children: [],
          parentUuid: 'w-5',
          taskStatus: 'TODO'
        },
        {
          uuid: 'w-5-2',
          content: 'Voyager tracks all tasks globally. You can see them aggregated in the **Tasks** tab in the main navigation menu.',
          children: [],
          parentUuid: 'w-5',
          taskStatus: 'DOING'
        }
      ],
      parentUuid: undefined
    }
  ];

  const spenBlocks: Block[] = [
    {
      uuid: 's-1',
      content: 'Welcome to the **S-Pen Studio**! 🖊️ The Samsung Galaxy S23 Ultra is famous for its integrated stylus. Voyager simulates the full stylus experience!',
      children: [],
      parentUuid: undefined
    },
    {
      uuid: 's-2',
      content: '### Air Command Menu ⚡',
      children: [
        {
          uuid: 's-2-1',
          content: 'Click the **S-Pen stylus** sticking out of the bottom-right corner of the device (or click the pen icon in the top header) to deploy the Air Command dial.',
          children: [],
          parentUuid: 's-2'
        },
        {
          uuid: 's-2-2',
          content: 'Select **Screen Write** to draw directly over your current screen! You can choose colors, stroke widths, erase, and click the Save checkmark to save the sketch directly into your journal as an image attachment.',
          children: [],
          parentUuid: 's-2'
        },
        {
          uuid: 's-2-3',
          content: 'Select **Handwrite OCR** to simulate stylus writing. Write on the canvas, and watch our handwriting recognition model translate your handwriting into editable blocks!',
          children: [],
          parentUuid: 's-2'
        },
        {
          uuid: 's-2-4',
          content: 'Select **Quick Memo** to take a quick scratchpad note that automatically appends to your journal page.',
          children: [],
          parentUuid: 's-2'
        }
      ],
      parentUuid: undefined
    }
  ];

  const mediaBlocks: Block[] = [
    {
      uuid: 'm-1',
      content: 'Welcome to the **Media Studio**! 📷 Voyager is built for rich multimedia journaling. Unlike standard web apps, it supports high-fidelity camera and voice recording.',
      children: [],
      parentUuid: undefined
    },
    {
      uuid: 'm-2',
      content: '### High-Fidelity Features 🎙️',
      children: [
        {
          uuid: 'm-2-1',
          content: '**Camera Stream**: Access your actual hardware camera directly in the app, take a photo, crop/rotate it, and embed it. Try it in the Media Studio tab!',
          children: [],
          parentUuid: 'm-2'
        },
        {
          uuid: 'm-2-2',
          content: '**Voice Recorder**: Record real audio notes using your microphone! Voyager generates a visual waveform, saves the recording as a local Blob in IndexedDB, and simulates a Whisper AI model to transcribe your voice instantly!',
          children: [],
          parentUuid: 'm-2'
        },
        {
          uuid: 'm-2-3',
          content: '**Binary Blob Storage**: Because everything is stored as binary Blobs in IndexedDB, you can store hundreds of photos and recordings without bloating state or exceeding storage limits.',
          children: [],
          parentUuid: 'm-2'
        }
      ],
      parentUuid: undefined
    }
  ];

  const journalBlocks: Block[] = [
    {
      uuid: 'j-1',
      content: `### Welcome to your Journal for ${todayStr}! 📅`,
      children: [],
      parentUuid: undefined
    },
    {
      uuid: 'j-2',
      content: 'This page is automatically created for today. Daily journals are the heart of [[Logseq]]. Use them to write quick notes, manage tasks, and record drawings or voice clips.',
      children: [
        {
          uuid: 'j-2-1',
          content: 'Plan your day: #productivity',
          children: [
            {
              uuid: 'j-2-1-1',
              content: 'Explore Voyager\'s [[Project Voyager 🚀]] interactive tour',
              children: [],
              parentUuid: 'j-2-1',
              taskStatus: 'TODO'
            },
            {
              uuid: 'j-2-1-2',
              content: 'Try out S-Pen drawing in the [[S-Pen Studio 🖊️]]',
              children: [],
              parentUuid: 'j-2-1',
              taskStatus: 'TODO'
            },
            {
              uuid: 'j-2-1-3',
              content: 'Record an audio note in the [[Media Studio 📷]]',
              children: [],
              parentUuid: 'j-2-1',
              taskStatus: 'TODO'
            }
          ],
          parentUuid: 'j-2'
        }
      ],
      parentUuid: undefined
    }
  ];

  return [
    {
      id: welcomePageId,
      name: 'Project Voyager 🚀',
      isJournal: false,
      createdAt: new Date().toISOString(),
      blocks: welcomeBlocks,
      tags: ['productivity', 'notes', 'knowledge-graph']
    },
    {
      id: spenPageId,
      name: 'S-Pen Studio 🖊️',
      isJournal: false,
      createdAt: new Date().toISOString(),
      blocks: spenBlocks,
      tags: ['spen', 'drawing', 'stylus']
    },
    {
      id: mediaPageId,
      name: 'Media Studio 📷',
      isJournal: false,
      createdAt: new Date().toISOString(),
      blocks: mediaBlocks,
      tags: ['camera', 'audio', 'whisper']
    },
    {
      id: todayId,
      name: todayStr,
      isJournal: true,
      createdAt: new Date().toISOString(),
      blocks: journalBlocks,
      tags: ['productivity']
    }
  ];
};
