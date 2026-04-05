import type { EvalRunResult } from '../types'

export interface GoldenExample {
  id: string
  query: string
  context: string
  answer: string
  citations: Array<{ url: string; title: string }>
  usedInteractiveOnlyOutput: boolean
  requiresTextAnswer: boolean
  requiresCitations: boolean
  allowsInteractiveOnly: boolean
  toolNames: string[]
  expected: {
    prechecks: { label: string; score: number }
    tool_usage: { label: string; score: number } | null // null = expect skip
    faithfulness: { label: string; score: number } | null // null = expect skip
    relevance: { label: string; score: number } | null // null = expect skip
    response_quality: { label: string; score: number }
  }
}

export function buildEvalOutput(example: GoldenExample): EvalRunResult {
  return {
    answerText: example.answer,
    citations: example.citations,
    searchResults: [],
    toolNames: example.toolNames,
    usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
    modelId: '',
    durationMs: 0
  }
}

export function getGoldenExamples(): GoldenExample[] {
  return [
    // ──────────────────────────────────────────────────────────────
    // TRUE POSITIVES — well-grounded, relevant, quality answers
    // ──────────────────────────────────────────────────────────────
    {
      id: 'tp-factual-grounded',
      query: 'What is the speed of light in a vacuum?',
      context:
        'The speed of light in a vacuum, commonly denoted c, is a universal physical constant important in many areas of physics. Its exact value is 299,792,458 metres per second. Light travels at approximately 186,000 miles per second.',
      answer:
        'The speed of light in a vacuum is exactly 299,792,458 metres per second (approximately 186,000 miles per second). This constant, denoted as "c", is fundamental across many areas of physics.',
      citations: [
        {
          url: 'https://en.wikipedia.org/wiki/Speed_of_light',
          title: 'Speed of light - Wikipedia'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-multi-sentence',
      query: 'How does photosynthesis work?',
      context:
        'Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. It occurs primarily in the chloroplasts of plant cells. The process has two main stages: the light-dependent reactions, which occur in the thylakoid membranes and produce ATP and NADPH, and the Calvin cycle (light-independent reactions), which occurs in the stroma and uses ATP and NADPH to fix carbon dioxide into glucose.',
      answer:
        'Photosynthesis is the process by which green plants, algae, and certain bacteria convert light energy into chemical energy in the form of glucose. This takes place primarily in chloroplasts and involves two main stages:\n\n1. **Light-dependent reactions** — These occur in the thylakoid membranes and produce ATP and NADPH using light energy.\n2. **Calvin cycle (light-independent reactions)** — This takes place in the stroma, where ATP and NADPH are used to fix carbon dioxide into glucose molecules.',
      citations: [
        {
          url: 'https://www.nature.com/scitable/photosynthesis',
          title: 'Photosynthesis - Nature Scitable'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-concise-answer',
      query: 'What year was the Berlin Wall built?',
      context:
        'The Berlin Wall was constructed beginning on August 13, 1961. It divided Berlin from 1961 until November 9, 1989, when the wall was opened. The wall was a symbol of the Cold War and the division between East and West.',
      answer:
        'The Berlin Wall was built in 1961, with construction beginning on August 13. It stood until November 9, 1989.',
      citations: [
        {
          url: 'https://www.history.com/topics/cold-war/berlin-wall',
          title: 'Berlin Wall - History'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-technical-topic',
      query: 'What is TCP/IP?',
      context:
        'TCP/IP (Transmission Control Protocol/Internet Protocol) is the fundamental communication protocol suite of the Internet. TCP handles breaking data into packets, ensuring reliable delivery and reassembly, while IP handles addressing and routing packets between networks. The model has four layers: link, internet, transport, and application.',
      answer:
        'TCP/IP (Transmission Control Protocol/Internet Protocol) is the foundational communication protocol suite that powers the Internet. It consists of two main protocols:\n\n- **TCP** handles breaking data into packets, ensuring they are delivered reliably and reassembled in the correct order.\n- **IP** manages addressing and routing those packets across networks.\n\nThe TCP/IP model is organized into four layers: link, internet, transport, and application.',
      citations: [
        {
          url: 'https://www.cloudflare.com/learning/ddos/glossary/tcp-ip/',
          title: 'What is TCP/IP? - Cloudflare'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-no-citations-required',
      query: 'What is the capital of France?',
      context:
        'France is a country in Western Europe. Its capital and largest city is Paris, which has a population of over 2 million people in the city proper.',
      answer: 'The capital of France is Paris.',
      citations: [],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: true,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: null,
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-historical-analysis',
      query: 'Why did the Roman Empire fall?',
      context:
        'The fall of the Western Roman Empire in 476 AD was caused by a combination of factors. These included military overexpansion, economic troubles and reliance on slave labor, government corruption and political instability, the arrival of the Huns and migration of barbarian tribes, weakening of the Roman legions, and the rise of Christianity which shifted focus from civic duty to spiritual matters. No single cause is agreed upon by historians.',
      answer:
        'The fall of the Western Roman Empire in 476 AD resulted from multiple interconnected factors rather than a single cause:\n\n- **Military overexpansion** made borders difficult to defend\n- **Economic troubles** and heavy reliance on slave labor undermined productivity\n- **Government corruption and political instability** weakened central authority\n- **Barbarian migrations** and pressure from the Huns displaced populations into Roman territory\n- **Weakening of the Roman legions** reduced defensive capability\n- **The rise of Christianity** shifted societal focus from civic duty to spiritual concerns\n\nHistorians continue to debate the relative importance of each factor.',
      citations: [
        {
          url: 'https://www.history.com/news/8-reasons-why-rome-fell',
          title: '8 Reasons Why Rome Fell - History'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-scientific-data',
      query: 'What is the boiling point of water?',
      context:
        'Water (H2O) boils at 100 degrees Celsius (212 degrees Fahrenheit) at standard atmospheric pressure (1 atm or 101.325 kPa). The boiling point decreases at higher altitudes due to lower atmospheric pressure. For example, at the top of Mount Everest (about 8,849 meters), water boils at approximately 70°C.',
      answer:
        'Water boils at 100°C (212°F) at standard atmospheric pressure (1 atm). However, the boiling point decreases at higher altitudes due to lower pressure — for instance, at the summit of Mount Everest, water boils at roughly 70°C.',
      citations: [
        {
          url: 'https://www.usgs.gov/special-topics/water-science-school',
          title: 'Water Science School - USGS'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-interactive-allowed',
      query: 'Show me a comparison of programming languages',
      context:
        'Python is known for simplicity and data science. JavaScript dominates web development. Rust focuses on memory safety and performance. Go is popular for cloud infrastructure and microservices.',
      answer:
        'Here is a comparison of popular programming languages based on the search results.',
      citations: [],
      usedInteractiveOnlyOutput: true,
      requiresTextAnswer: false,
      requiresCitations: false,
      allowsInteractiveOnly: true,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: null,
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },

    // ──────────────────────────────────────────────────────────────
    // TRUE POSITIVES — tool-usage examples
    // ──────────────────────────────────────────────────────────────
    {
      id: 'tp-tool-search-fetch',
      query: 'What is the current state of nuclear fusion research?',
      context:
        'In December 2022, scientists at the National Ignition Facility (NIF) at Lawrence Livermore National Laboratory achieved fusion ignition for the first time, producing more energy from fusion than the laser energy used to drive it. The experiment delivered 2.05 megajoules of energy to the target, resulting in 3.15 megajoules of fusion energy output. Multiple private companies including Commonwealth Fusion Systems, TAE Technologies, and Helion Energy are pursuing commercial fusion reactors, with some targeting demonstration plants by the early 2030s.',
      answer:
        'Nuclear fusion research has reached a significant milestone. In December 2022, the National Ignition Facility (NIF) at Lawrence Livermore National Laboratory achieved fusion ignition for the first time, producing 3.15 megajoules of fusion energy output from 2.05 megajoules of laser energy input.\n\nBeyond government labs, several private companies are racing toward commercial fusion:\n\n- **Commonwealth Fusion Systems** — developing compact tokamak reactors\n- **TAE Technologies** and **Helion Energy** — pursuing alternative fusion approaches\n\nSome of these companies are targeting demonstration plants by the early 2030s.',
      citations: [
        {
          url: 'https://www.llnl.gov/news/national-ignition-facility-achieves-fusion-ignition',
          title: 'NIF Achieves Fusion Ignition - LLNL'
        },
        {
          url: 'https://www.energy.gov/science/doe-explainsnuclear-fusion-reactions',
          title: 'DOE Explains Nuclear Fusion - Energy.gov'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search', 'fetch'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-tool-search-only',
      query: 'What programming language is Rust inspired by?',
      context:
        'Rust is a systems programming language that was first released in 2010 by Mozilla Research. It draws inspiration from several languages: C++ for its systems-level capabilities, ML and Haskell for its type system and pattern matching, and Erlang for its approach to concurrency. Rust emphasizes memory safety without garbage collection through its ownership and borrowing system.',
      answer:
        'Rust draws inspiration from multiple programming languages. From C++, it takes systems-level capabilities. Its type system and pattern matching are influenced by ML and Haskell, while its concurrency model borrows ideas from Erlang. Rust was first released in 2010 by Mozilla Research and is distinguished by its ownership and borrowing system, which ensures memory safety without requiring garbage collection.',
      citations: [
        {
          url: 'https://doc.rust-lang.org/reference/influences.html',
          title: 'Influences - The Rust Reference'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },

    // ──────────────────────────────────────────────────────────────
    // TRUE POSITIVES — domain diversity (mathematics, geography)
    // ──────────────────────────────────────────────────────────────
    {
      id: 'tp-mathematics',
      query: 'What is the Pythagorean theorem?',
      context:
        'The Pythagorean theorem is a fundamental relation in Euclidean geometry among the three sides of a right triangle. It states that the area of the square whose side is the hypotenuse (the side opposite the right angle) is equal to the sum of the areas of the squares on the other two sides. Algebraically, if the two shorter sides have lengths a and b, and the hypotenuse has length c, the theorem can be written as a² + b² = c². The theorem is named after the ancient Greek mathematician Pythagoras, though it was known to Babylonian mathematicians over a thousand years earlier.',
      answer:
        'The Pythagorean theorem describes the relationship between the sides of a right triangle. It states that the square of the hypotenuse (the side opposite the right angle) equals the sum of the squares of the other two sides:\n\n**a² + b² = c²**\n\nwhere a and b are the lengths of the two shorter sides and c is the length of the hypotenuse. Named after the Greek mathematician Pythagoras, the theorem was actually known to Babylonian mathematicians over a thousand years before his time.',
      citations: [
        {
          url: 'https://www.britannica.com/science/Pythagorean-theorem',
          title: 'Pythagorean theorem - Britannica'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'tp-geography',
      query: 'What is the longest river in Africa?',
      context:
        'The Nile is the longest river in Africa and is generally regarded as the longest river in the world, stretching approximately 6,650 kilometers (4,130 miles) from its sources in the highlands of East Africa to the Mediterranean Sea. It flows through eleven countries including Uganda, Sudan, and Egypt. The Nile has two major tributaries: the White Nile, which originates from Lake Victoria, and the Blue Nile, which begins at Lake Tana in Ethiopia. The Blue Nile contributes approximately 80% of the water in the Nile during the flood season.',
      answer:
        "The longest river in Africa is the Nile, stretching approximately 6,650 kilometers (4,130 miles) from the East African highlands to the Mediterranean Sea. It flows through eleven countries, including Uganda, Sudan, and Egypt.\n\nThe Nile has two major tributaries:\n\n- **White Nile** — originates from Lake Victoria\n- **Blue Nile** — begins at Lake Tana in Ethiopia and contributes roughly 80% of the Nile's water during flood season",
      citations: [
        {
          url: 'https://www.britannica.com/place/Nile-River',
          title: 'Nile River - Britannica'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },

    // ──────────────────────────────────────────────────────────────
    // TRUE NEGATIVES — bad answers that should fail
    // ──────────────────────────────────────────────────────────────
    {
      id: 'tn-tool-used-but-hallucinated',
      query: 'How tall is Mount Kilimanjaro?',
      context:
        'Mount Kilimanjaro is a dormant volcano in Tanzania and the highest peak in Africa. Its summit, Uhuru Peak, stands at 5,895 meters (19,341 feet) above sea level. The mountain has three volcanic cones: Kibo, Mawenzi, and Shira. Kilimanjaro is part of Kilimanjaro National Park and is a major climbing destination, attracting around 35,000 trekkers per year.',
      answer:
        'Mount Kilimanjaro stands at 8,412 meters (27,598 feet) above sea level, making it nearly as tall as Mount Everest. It is an active volcano located in Kenya that last erupted in 2019. The mountain has five volcanic cones and receives over 500,000 climbers annually.',
      citations: [
        {
          url: 'https://www.britannica.com/place/Kilimanjaro',
          title: 'Kilimanjaro - Britannica'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: ['search', 'fetch'],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'tools_used', score: 1 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-hallucinated-facts',
      query: 'What is the population of Tokyo?',
      context:
        'Tokyo is the capital of Japan. The Tokyo metropolitan area has a population of approximately 14 million people as of 2023. Greater Tokyo, including surrounding prefectures, has about 37 million residents.',
      answer:
        'Tokyo has a population of 52 million people, making it the largest city on Earth by a wide margin. The city was founded in 1203 by Emperor Tokugawa and has been the capital of Japan since the 15th century.',
      citations: [
        {
          url: 'https://worldpopulationreview.com/cities/tokyo',
          title: 'Tokyo Population - World Population Review'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-wrong-topic',
      query: 'What causes earthquakes?',
      context:
        "Earthquakes are caused by the sudden release of energy in the Earth's lithosphere that creates seismic waves. They result from tectonic plate movements along fault lines, volcanic activity, or human activities like mining and reservoir-induced seismicity.",
      answer:
        "The Great Barrier Reef is the world's largest coral reef system, stretching over 2,300 kilometers along the northeast coast of Australia. It is home to over 1,500 species of fish and 400 types of coral. Climate change and ocean acidification pose major threats to the reef ecosystem.",
      citations: [
        {
          url: 'https://www.gbrmpa.gov.au/',
          title: 'Great Barrier Reef Marine Park Authority'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-vague-padding',
      query: 'How does CRISPR gene editing work?',
      context:
        "CRISPR-Cas9 is a genome editing tool that uses a guide RNA to direct the Cas9 enzyme to a specific location in the DNA. The Cas9 enzyme then cuts both strands of the DNA at the targeted location. The cell's natural repair mechanisms then fix the break, allowing scientists to add, remove, or alter genetic material.",
      answer:
        "Gene editing is a really interesting topic that has been gaining a lot of attention in recent years. There are many different approaches and techniques that scientists are exploring. It's a complex field with lots of potential applications. Many researchers around the world are working on this. The technology continues to evolve and improve over time. It's definitely something worth keeping an eye on.",
      citations: [
        {
          url: 'https://www.genome.gov/genetics-glossary/CRISPR',
          title: 'CRISPR - Genome.gov'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-contradicts-context',
      query: 'Is Pluto a planet?',
      context:
        'In 2006, the International Astronomical Union (IAU) reclassified Pluto as a "dwarf planet" because it has not cleared its orbital neighborhood of other debris. Pluto is now classified alongside other dwarf planets like Eris and Haumea. This decision remains controversial among some astronomers.',
      answer:
        "Yes, Pluto is fully classified as the ninth planet in our solar system. The International Astronomical Union confirmed its planetary status in 2006, establishing that Pluto meets all criteria for a full planet. There has never been any debate about Pluto's classification.",
      citations: [
        {
          url: 'https://solarsystem.nasa.gov/planets/dwarf-planets/pluto/',
          title: 'Pluto - NASA'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-off-topic-rambling',
      query: 'What are the health benefits of green tea?',
      context:
        'Green tea contains polyphenols and catechins, particularly EGCG (epigallocatechin gallate), which have antioxidant properties. Studies suggest green tea may help reduce the risk of cardiovascular disease, support weight management, and improve brain function. It also contains L-theanine, which can promote relaxation without drowsiness.',
      answer:
        'Speaking of beverages, I recently learned about the history of coffee houses in 17th century England. They were called "penny universities" because for the price of a penny, one could purchase a cup of coffee and engage in stimulating conversation. The first coffee house in England opened in Oxford in 1652. Coffee houses became important centers of social interaction and business. Lloyd\'s of London actually started as a coffee house. Quite fascinating really.',
      citations: [
        {
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2855614/',
          title: 'Green Tea and Health - NCBI'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-garbled-text',
      query: 'What is machine learning?',
      context:
        'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data, learn from it, and make predictions or decisions. Common types include supervised learning, unsupervised learning, and reinforcement learning.',
      answer:
        'Machine learning is the when computer does the thing with data and then algorithm process information systems neural network deep learning big data analytics pipeline optimization framework deployment infrastructure cloud-based solution enterprise-grade implementation methodology.',
      citations: [
        {
          url: 'https://www.ibm.com/topics/machine-learning',
          title: 'What is Machine Learning? - IBM'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-irrelevant-citations',
      query: 'What causes tides?',
      context:
        "Tides are caused primarily by the gravitational pull of the Moon on the Earth's oceans. The Sun also exerts a gravitational force that affects tides, though its effect is about 46% that of the Moon. When the Sun and Moon align (during new and full moons), spring tides occur with higher high tides and lower low tides.",
      answer:
        'Tides are caused by wind patterns blowing across the ocean surface. Strong offshore winds push water toward the shore, creating high tides, while onshore winds pull water away from the coast, resulting in low tides. The strength of tides depends primarily on seasonal weather patterns and ocean currents.',
      citations: [
        {
          url: 'https://www.weather.gov/wind-patterns',
          title: 'Wind Patterns - National Weather Service'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },
    {
      id: 'tn-superficial-wrong',
      query: 'How many moons does Mars have?',
      context:
        'Mars has two small moons: Phobos and Deimos. Phobos is the larger of the two with a mean radius of about 11 km, while Deimos has a mean radius of about 6 km. Both are thought to be captured asteroids. Phobos orbits very close to Mars and is slowly spiraling inward.',
      answer:
        'Mars has seven moons, the largest of which is called Titan. These moons were discovered by Galileo Galilei in 1610 using his telescope.',
      citations: [
        {
          url: 'https://solarsystem.nasa.gov/moons/mars-moons/',
          title: 'Mars Moons - NASA'
        }
      ],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'unfaithful', score: 0 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'fail', score: 0 }
      }
    },

    // ──────────────────────────────────────────────────────────────
    // EDGE CASES — structural/boundary cases
    // ──────────────────────────────────────────────────────────────
    {
      id: 'edge-empty-answer',
      query: 'What is quantum computing?',
      context:
        'Quantum computing uses quantum bits (qubits) that can exist in superposition states, allowing quantum computers to process multiple possibilities simultaneously. Key concepts include superposition, entanglement, and quantum interference.',
      answer: '',
      citations: [],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: true,
      toolNames: [],
      expected: {
        prechecks: { label: 'missing_answer', score: 0 },
        tool_usage: null,
        faithfulness: null,
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'no_answer', score: 0 }
      }
    },
    {
      id: 'edge-missing-citations',
      query: 'What is blockchain technology?',
      context:
        'Blockchain is a distributed, decentralized ledger technology that records transactions across many computers. Each block contains a cryptographic hash of the previous block, a timestamp, and transaction data. This design makes it resistant to modification of the data.',
      answer:
        'Blockchain is a distributed ledger technology that records transactions across a network of computers. Each block contains a cryptographic hash of the previous block, a timestamp, and transaction data, making the chain resistant to modification.',
      citations: [],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: true,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'missing_citations', score: 0 },
        tool_usage: { label: 'missing_tools', score: 0 },
        faithfulness: { label: 'faithful', score: 1 },
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'good', score: 0.75 }
      }
    },
    {
      id: 'edge-interactive-only-disallowed',
      query: 'Compare renewable energy sources',
      context:
        'Solar, wind, and hydroelectric power are the three largest sources of renewable energy globally. Solar capacity has grown 20x in the last decade.',
      answer: '',
      citations: [],
      usedInteractiveOnlyOutput: true,
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: false,
      toolNames: [],
      expected: {
        prechecks: { label: 'interactive_only_output', score: 0 },
        tool_usage: null,
        faithfulness: null,
        relevance: { label: 'relevant', score: 1 },
        response_quality: { label: 'no_answer', score: 0 }
      }
    },
    {
      id: 'edge-empty-context',
      query: 'What is the meaning of life?',
      context: '',
      answer:
        'The meaning of life is a philosophical question that has been debated throughout human history. Different philosophical traditions offer various perspectives, from existentialism to religious frameworks.',
      citations: [],
      usedInteractiveOnlyOutput: false,
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: true,
      toolNames: [],
      expected: {
        prechecks: { label: 'pass', score: 1 },
        tool_usage: null,
        faithfulness: null,
        relevance: { label: 'no_results', score: 0 },
        response_quality: { label: 'good', score: 0.75 }
      }
    }
  ]
}
