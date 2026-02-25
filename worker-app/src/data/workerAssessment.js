export const workerCategories = [
  { value: "Home Cleaning", icon: "sparkle" },
  { value: "Plumbing", icon: "wrench" },
  { value: "Electrical", icon: "bolt" },
  { value: "AC Repair", icon: "wind" },
  { value: "Cooking", icon: "chef" },
  { value: "Babysitting", icon: "baby" },
  { value: "Elder Care", icon: "elder" },
  { value: "Painting", icon: "paint" },
  { value: "Mechanic", icon: "car" },
  { value: "Shifting Help", icon: "truck" }
];

export const categoryQuestionBank = {
  "Home Cleaning": [
    {
      id: "clean-1",
      prompt: "For heavy kitchen grease, what should be used first for safe and effective removal?",
      options: ["Strong perfume spray", "Degreaser solution", "Plain water only", "Dry cloth only"],
      answerIndex: 1
    },
    {
      id: "clean-2",
      prompt: "What is the most hygienic order for cleaning a room?",
      options: ["Bottom to top", "Top to bottom", "Random order", "Door to door only"],
      answerIndex: 1
    },
    {
      id: "clean-3",
      prompt: "Which cloth type is best for streak-free surface cleaning?",
      options: ["Microfiber cloth", "Old cotton waste", "Paper tissue only", "Jute fabric"],
      answerIndex: 0
    }
  ],
  Plumbing: [
    {
      id: "plumb-1",
      prompt: "Before repairing a leaking line, what must be done first?",
      options: ["Increase water pressure", "Switch off main water supply", "Heat the pipe", "Add tape externally"],
      answerIndex: 1
    },
    {
      id: "plumb-2",
      prompt: "Which tape is commonly used for threaded plumbing joints?",
      options: ["PVC insulation tape", "PTFE thread seal tape", "Masking tape", "Fabric tape"],
      answerIndex: 1
    },
    {
      id: "plumb-3",
      prompt: "For smooth drainage, pipe slope should generally be:",
      options: ["Flat (0%)", "Slight downward slope", "Steep upward slope", "Random as per wall"],
      answerIndex: 1
    }
  ],
  Electrical: [
    {
      id: "elec-1",
      prompt: "If an MCB keeps tripping repeatedly, it most likely indicates:",
      options: ["Low internet speed", "Overload or short circuit", "Water shortage", "Battery backup issue"],
      answerIndex: 1
    },
    {
      id: "elec-2",
      prompt: "Which safety gear is essential during live electrical diagnosis?",
      options: ["Rubber-insulated gloves", "Wool gloves", "Bare hands", "Metal watch"],
      answerIndex: 0
    },
    {
      id: "elec-3",
      prompt: "The first step before replacing a switchboard is:",
      options: ["Switch off the power source", "Spray water", "Remove wall putty", "Call customer only"],
      answerIndex: 0
    }
  ],
  "AC Repair": [
    {
      id: "ac-1",
      prompt: "For reduced cooling, the first maintenance step is usually:",
      options: ["Replace compressor immediately", "Clean air filters", "Increase thermostat limit", "Change room lights"],
      answerIndex: 1
    },
    {
      id: "ac-2",
      prompt: "Recommended cleaning interval for AC filters in regular use is:",
      options: ["Every 2-4 weeks", "Once every 2 years", "Never required", "Only in winter"],
      answerIndex: 0
    },
    {
      id: "ac-3",
      prompt: "Who should handle refrigerant charging safely?",
      options: ["Any helper", "Certified technician", "Customer", "Carpenter"],
      answerIndex: 1
    }
  ],
  Cooking: [
    {
      id: "cook-1",
      prompt: "A key practice to avoid cross-contamination is:",
      options: ["Same board for all items", "Separate boards for raw and cooked food", "Wash once daily only", "Use cloth without washing"],
      answerIndex: 1
    },
    {
      id: "cook-2",
      prompt: "Safe internal temperature for reheated food should reach about:",
      options: ["40C", "75C", "20C", "10C"],
      answerIndex: 1
    },
    {
      id: "cook-3",
      prompt: "When oil starts smoking heavily, you should:",
      options: ["Continue cooking", "Reduce heat and reset pan", "Add water", "Cover and ignore"],
      answerIndex: 1
    }
  ],
  Babysitting: [
    {
      id: "baby-1",
      prompt: "A toddler must never be left unattended near:",
      options: ["Story books", "Open balcony/water area", "Soft toys", "Bed sheets"],
      answerIndex: 1
    },
    {
      id: "baby-2",
      prompt: "In any emergency, the first action should be:",
      options: ["Post online", "Inform guardian immediately", "Wait for shift end", "Ask neighbors later"],
      answerIndex: 1
    },
    {
      id: "baby-3",
      prompt: "Child hygiene best practice includes:",
      options: ["Skipping handwash", "Frequent hand sanitization and clean surfaces", "One towel for all", "No diaper checks"],
      answerIndex: 1
    }
  ],
  "Elder Care": [
    {
      id: "elder-1",
      prompt: "Medication for elders should be given:",
      options: ["Only when reminded by memory", "Exactly as prescribed and documented", "Twice the prescribed dose", "At random times"],
      answerIndex: 1
    },
    {
      id: "elder-2",
      prompt: "A strong fall-prevention step at home is:",
      options: ["Dim walkways", "Clear clutter and secure loose rugs", "Keep wet floors", "Move furniture daily"],
      answerIndex: 1
    },
    {
      id: "elder-3",
      prompt: "Hydration monitoring is important because:",
      options: ["It has no effect", "It supports health and recovery", "Only for children", "Only in hospitals"],
      answerIndex: 1
    }
  ],
  Painting: [
    {
      id: "paint-1",
      prompt: "Before paint application, wall preparation should include:",
      options: ["Dust and prime as needed", "Paint directly over dirt", "Only wet the wall", "Skip sanding always"],
      answerIndex: 0
    },
    {
      id: "paint-2",
      prompt: "For a premium finish, it is better to apply:",
      options: ["One very thick coat", "Multiple thin coats", "No primer ever", "Random patches"],
      answerIndex: 1
    },
    {
      id: "paint-3",
      prompt: "Drying time between coats should be based on:",
      options: ["Customer guess", "Manufacturer recommendation", "Worker mood", "No wait needed"],
      answerIndex: 1
    }
  ],
  Mechanic: [
    {
      id: "mech-1",
      prompt: "Engine oil level should be checked using:",
      options: ["Coolant cap", "Dipstick on level surface", "Brake pedal", "Wiper tank"],
      answerIndex: 1
    },
    {
      id: "mech-2",
      prompt: "Frequent brake squeal can indicate:",
      options: ["Good performance always", "Brake wear requiring inspection", "Normal radio issue", "Tyre inflation increase"],
      answerIndex: 1
    },
    {
      id: "mech-3",
      prompt: "Tyre pressure should ideally be checked:",
      options: ["Monthly and before long drives", "Only once a year", "Never", "Only after puncture"],
      answerIndex: 0
    }
  ],
  "Shifting Help": [
    {
      id: "shift-1",
      prompt: "Safe lifting technique for heavy boxes is:",
      options: ["Bend back sharply", "Bend knees and keep load close", "Twist while lifting", "Lift with one hand"],
      answerIndex: 1
    },
    {
      id: "shift-2",
      prompt: "Fragile items are best packed using:",
      options: ["No padding", "Bubble wrap and marked labels", "Loose plastic only", "Open cartons"],
      answerIndex: 1
    },
    {
      id: "shift-3",
      prompt: "Why should boxes be labeled room-wise during shifting?",
      options: ["For decoration only", "For faster organized unloading", "Not necessary", "To increase weight"],
      answerIndex: 1
    }
  ]
};
