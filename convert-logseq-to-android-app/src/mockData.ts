import { Page, Block } from './types';

// Helper to generate unique IDs
export const generateId = () => Math.random().toString(36).substring(2, 11);

export const getInitialPages = (): Page[] => {
  const guideBlocks: Block[] = [
    {
      id: 'g1',
      content: 'Welcome to **Logseq** on the **Samsung Galaxy S23 Ultra**! 🚀',
      children: [
        {
          id: 'g1_1',
          content: 'Logseq is a local-first, privacy-first knowledge base that organizes your thoughts as a **connected graph** of outlines.',
          children: []
        },
        {
          id: 'g1_2',
          content: 'This app is running inside a high-fidelity **Samsung S23 Ultra simulator**, fully integrated with its hardware features like the **S-Pen**!',
          children: []
        }
      ]
    },
    {
      id: 'g2',
      content: '## Core Outliner Features 🌲',
      children: [
        {
          id: 'g2_1',
          content: '**Outliner Blocks**: Every paragraph is a block. You can nest blocks infinitely to structure your thinking.',
          children: [
            {
              id: 'g2_1_1',
              content: 'Press **Enter** to create a new block.',
              children: []
            },
            {
              id: 'g2_1_2',
              content: 'Press **Tab** to indent a block (make it a child).',
              children: []
            },
            {
              id: 'g2_1_3',
              content: 'Press **Shift+Tab** to outdent (move it up a level).',
              children: []
            },
            {
              id: 'g2_1_4',
              content: 'On mobile, use the keyboard toolbar buttons: `⇥` (Indent), `⇤` (Outdent), and `▲`/`▼` to move blocks up and down easily.',
              children: []
            }
          ]
        },
        {
          id: 'g2_2',
          content: '**Task Management**: You can turn any block into a task by typing `/todo` or clicking the checkbox area.',
          children: [
            {
              id: 'g2_2_1',
              todoType: 'LATER',
              content: 'Try completing this task by tapping the checkbox!',
              children: []
            },
            {
              id: 'g2_2_2',
              todoType: 'NOW',
              content: 'This task is active. Tap it to cycle through: `NOW` ➔ `DONE` ➔ `LATER` ➔ `TODO` ➔ none.',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'g3',
      content: '## Bi-directional Linking 🔗',
      children: [
        {
          id: 'g3_1',
          content: 'Create links to other pages by wrapping words in double brackets, like [[Samsung S23 Ultra]] or [[Project Voyager]].',
          children: [
            {
              id: 'g3_1_1',
              content: 'Clicking a link like [[Project Voyager]] instantly navigates to that page.',
              children: []
            },
            {
              id: 'g3_1_2',
              content: 'On mobile, tap the **Sidebar Icon** or Shift+Click a link to open it in the **Right Drawer Sidebar** for side-by-side editing!',
              children: []
            }
          ]
        },
        {
          id: 'g3_2',
          content: 'You can also use hashtags like #tag or #productivity. They work exactly like page links!',
          children: []
        },
        {
          id: 'g3_3',
          content: 'Every page shows its **Linked References** (backlinks) at the bottom. Try navigating to [[Samsung S23 Ultra]] to see links pointing back to this guide!',
          children: []
        }
      ]
    },
    {
      id: 'g4',
      content: '## Flashcards & Spaced Repetition 📇',
      children: [
        {
          id: 'g4_1',
          content: 'Add the `#card` tag to any block to turn it into a flashcard. The parent block becomes the front, and its nested children become the back!',
          children: [
            {
              id: 'g4_1_1',
              content: 'What does local-first mean? #card',
              children: [
                {
                  id: 'g4_1_1_1',
                  content: 'It means your data is stored locally on your device first, giving you full ownership, privacy, and offline accessibility!',
                  children: []
                }
              ]
            },
            {
              id: 'g4_1_2',
              content: 'How do you trigger the S-Pen Air Command on this S23 Ultra simulation? #card',
              children: [
                {
                  id: 'g4_1_2_1',
                  content: 'Click on the S-Pen slot located at the bottom-left corner of the phone frame to eject it. A floating menu will appear!',
                  children: []
                }
              ]
            }
          ]
        },
        {
          id: 'g4_2',
          content: 'Tap the **Flashcards** icon in the bottom navbar or sidebar to test yourself using our Spaced Repetition card reviewer!',
          children: []
        }
      ]
    },
    {
      id: 'g5',
      content: '## Interactive Graph View 🌐',
      children: [
        {
          id: 'g5_1',
          content: 'Tap the **Graph** icon in the bottom menu to see a visual map of your notes. You will see nodes representing [[Logseq Guide]], [[Samsung S23 Ultra]], and [[Project Voyager]] connected by lines!',
          children: []
        }
      ]
    }
  ];

  const s23Blocks: Block[] = [
    {
      id: 's1',
      content: '# Samsung Galaxy S23 Ultra 📱',
      children: [
        {
          id: 's1_1',
          content: 'This phone is simulated with extreme precision, replicating physical and software characteristics of Samsung\'s premium flagship.',
          children: []
        }
      ]
    },
    {
      id: 's2',
      content: '## Hardware Specs ⚙️',
      children: [
        {
          id: 's2_1',
          content: '**Screen**: 6.8" Dynamic AMOLED 2X, Quad HD+ (3088 x 1440), 120Hz adaptive refresh, HDR10+, 1750 nits peak brightness.',
          children: []
        },
        {
          id: 's2_2',
          content: '**Processor**: Snapdragon 8 Gen 2 for Galaxy (4nm customized high-frequency chipset).',
          children: []
        },
        {
          id: 's2_3',
          content: '**Camera System**: 200MP Main + 12MP Ultra-wide + 10MP (3x Telephoto) + 10MP (10x Optical / 100x Space Zoom) cameras.',
          children: []
        },
        {
          id: 's2_4',
          content: '**Battery**: 5000 mAh with 45W super fast charging.',
          children: []
        }
      ]
    },
    {
      id: 's3',
      content: '## Embedded S-Pen Integration ✏️',
      children: [
        {
          id: 's3_1',
          content: 'The S-Pen is stored in the bottom-left corner of the phone. Click it to eject and try these custom features:',
          children: [
            {
              id: 's3_1_1',
              content: '✍️ **Screen Write / Canvas**: Overlay a drawing canvas on top of your Logseq notes. Use the pen to draw, highlight, erase, or take handwritten notes. You can **insert your drawings** directly into your current Logseq block!',
              children: []
            },
            {
              id: 's3_1_2',
              content: '⌨️ **Handwrite-to-Text**: Write letters on the drawing pad, and watch the simulated smart OCR engine translate it into editable typed text in real time!',
              children: []
            },
            {
              id: 's3_1_3',
              content: '📝 **Quick Float Note**: Take a fast note that floats above everything else and syncs directly with today\'s journal.',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 's4',
      content: '## Interactive S23 Action Checklist 🧪',
      children: [
        {
          id: 's4_1',
          todoType: 'TODO',
          content: 'Eject the S-Pen and draw a quick diagram using the **Screen Write** tool.',
          children: []
        },
        {
          id: 's4_2',
          todoType: 'TODO',
          content: 'Use the camera app from the phone\'s Home Screen to snap a photo and insert it into a block.',
          children: []
        },
        {
          id: 's4_3',
          todoType: 'DONE',
          content: 'Read the [[Logseq Guide]] to understand bi-directional links.',
          children: []
        },
        {
          id: 's4_4',
          todoType: 'LATER',
          content: 'Customize the phone settings: change the bezel color to *Botanic Green* or *Lavender*, and switch from buttons to Gesture Navigation!',
          children: []
        }
      ]
    }
  ];

  const voyagerBlocks: Block[] = [
    {
      id: 'v1',
      content: '# Project Voyager 🚀',
      children: [
        {
          id: 'v1_1',
          content: 'A local-first planning space for our next-generation reusable spacecraft control system. Connected to #productivity and #engineering.',
          children: []
        }
      ]
    },
    {
      id: 'v2',
      content: '## Active Tasks 📋',
      children: [
        {
          id: 'v2_1',
          todoType: 'NOW',
          content: 'Code the telemetry parser in Rust for real-time sensor streams.',
          children: [
            {
              id: 'v2_1_1',
              content: 'Must handle up to 10,000 packets per second with sub-millisecond latency.',
              children: []
            }
          ]
        },
        {
          id: 'v2_2',
          todoType: 'LATER',
          content: 'Perform stress testing of atmospheric entry thermal shielding algorithms.',
          children: []
        },
        {
          id: 'v2_3',
          todoType: 'DONE',
          content: 'Define communication protocol between navigation computer and thruster valves.',
          children: [
            {
              id: 'v2_3_1',
              content: 'Decision: Use CAN-bus standard with custom lightweight payload wrappers.',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'v3',
      content: '## Meeting Notes: 2026-03-02 📝',
      children: [
        {
          id: 'v3_1',
          content: 'Discussed orbital insertion windows and fuel margin requirements.',
          children: [
            {
              id: 'v3_1_1',
              content: 'Need at least 15% fuel reserve for emergency de-orbit maneuvers.',
              children: []
            },
            {
              id: 'v3_1_2',
              content: 'Next meeting scheduled for [[March 3rd, 2026]] to review thruster test data.',
              children: []
            }
          ]
        }
      ]
    }
  ];

  const j1Blocks: Block[] = [
    {
      id: 'j1_a',
      content: 'Started setting up the new **Samsung S23 Ultra** phone! The screen is absolutely stunning. 🌟',
      children: []
    },
    {
      id: 'j1_b',
      content: 'Installed the mobile client of [[Logseq]] to organize my daily logs and brainstorm [[Project Voyager]].',
      children: [
        {
          id: 'j1_b_1',
          content: 'Wow, the bi-directional linking is super fast. I can create a page by just typing `[[Project Voyager]]` and it updates the graph instantly.',
          children: []
        }
      ]
    },
    {
      id: 'j1_c',
      todoType: 'DONE',
      content: 'Verify S-Pen pressure sensitivity and note-taking speed.',
      children: []
    }
  ];

  const j2Blocks: Block[] = [
    {
      id: 'j2_a',
      content: 'Worked on [[Project Voyager]] flight computer code today. Met with the propulsion team.',
      children: [
        {
          id: 'j2_a_1',
          content: 'Propulsion team needs final valve control specs by tomorrow.',
          children: []
        }
      ]
    },
    {
      id: 'j2_b',
      content: 'Created some review cards for my upcoming aerospace certification! #card',
      children: [
        {
          id: 'j2_b_1',
          content: 'What is the escape velocity of Earth? #card',
          children: [
            {
              id: 'j2_b_1_1',
              content: 'Approximately 11.2 km/s (or about 25,000 mph).',
              children: []
            }
          ]
        },
        {
          id: 'j2_b_2',
          content: 'What is the primary engine cycle used by the Raptor engine? #card',
          children: [
            {
              id: 'j2_b_2_1',
              content: 'Full-flow staged combustion cycle (FFSCC).',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'j2_c',
      todoType: 'DONE',
      content: 'Read through the [[Logseq Guide]] to understand outline keyboard shortcuts.',
      children: []
    }
  ];

  const j3Blocks: Block[] = [
    {
      id: 'j3_a',
      content: 'Good morning! Today is a fresh day. Logged in from my [[Samsung S23 Ultra]]. ☀️',
      children: []
    },
    {
      id: 'j3_b',
      todoType: 'NOW',
      content: 'Review flight simulation data for [[Project Voyager]].',
      children: []
    },
    {
      id: 'j3_c',
      todoType: 'TODO',
      content: 'Write today\'s progress summary and share it with the team.',
      children: []
    },
    {
      id: 'j3_d',
      content: 'Quick thought: The S-Pen on the S23 Ultra is perfect for sketching layouts. I can write a handwritten note, and it transcribes instantly into Logseq!',
      children: []
    }
  ];

  return [
    {
      name: 'Logseq Guide',
      isJournal: false,
      blocks: guideBlocks,
      updatedAt: Date.now() - 3600000 * 5
    },
    {
      name: 'Samsung S23 Ultra',
      isJournal: false,
      blocks: s23Blocks,
      updatedAt: Date.now() - 3600000 * 3
    },
    {
      name: 'Project Voyager',
      isJournal: false,
      blocks: voyagerBlocks,
      updatedAt: Date.now() - 3600000 * 2
    },
    {
      name: 'March 1st, 2026',
      isJournal: true,
      journalDate: '2026-03-01',
      blocks: j1Blocks,
      updatedAt: Date.now() - 3600000 * 48
    },
    {
      name: 'March 2nd, 2026',
      isJournal: true,
      journalDate: '2026-03-02',
      blocks: j2Blocks,
      updatedAt: Date.now() - 3600000 * 24
    },
    {
      name: 'March 3rd, 2026',
      isJournal: true,
      journalDate: '2026-03-03',
      blocks: j3Blocks,
      updatedAt: Date.now()
    }
  ];
};
