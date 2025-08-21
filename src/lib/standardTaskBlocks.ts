export interface StandardTask {
  title: string;
  description: string;
  phase: 'planning' | 'execution' | 'verification' | 'documentation';
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  status: 'not_started' | 'in_progress' | 'completed';
}

export const STANDARD_TASK_BLOCKS: Record<string, StandardTask[]> = {
  // Planning Phase Tasks
  planning: [
    {
      title: "Site Assessment",
      description: "Evaluate the work area and identify potential challenges",
      phase: "planning",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Resource Planning",
      description: "Identify and secure all required materials and tools",
      phase: "planning", 
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Safety Planning",
      description: "Review safety requirements and prepare safety measures",
      phase: "planning",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ],

  // Execution Phase Tasks
  execution: [
    {
      title: "Prepare Work Area",
      description: "Set up work area and organize tools and materials",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Execute Primary Work",
      description: "Perform the main work activity",
      phase: "execution", 
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Clean Up Work Area",
      description: "Clean and organize work area, return tools",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ],

  // Verification Phase Tasks  
  verification: [
    {
      title: "Quality Check",
      description: "Verify work meets specifications and standards",
      phase: "verification",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Functionality Test",
      description: "Test that completed work functions as intended",
      phase: "verification",
      estimated_completion_date: undefined, 
      required_tools: [],
      status: "not_started"
    }
  ],

  // Documentation Phase Tasks
  documentation: [
    {
      title: "Photo Documentation",
      description: "Take before and after photos of the work",
      phase: "documentation",
      estimated_completion_date: undefined,
      required_tools: ["Camera/Phone"],
      status: "not_started"
    },
    {
      title: "Update Records",
      description: "Update maintenance logs and documentation",
      phase: "documentation", 
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ]
};

// Mission-specific task templates
export const MISSION_TEMPLATES: Record<string, StandardTask[]> = {
  construction: [
    ...STANDARD_TASK_BLOCKS.planning,
    {
      title: "Measure and Mark",
      description: "Take accurate measurements and mark cutting/drilling points",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Measuring Tape", "Pencil", "Level"],
      status: "not_started"
    },
    {
      title: "Cut Materials",
      description: "Cut materials to required dimensions",
      phase: "execution", 
      estimated_completion_date: undefined,
      required_tools: ["Saw", "Safety Equipment"],
      status: "not_started"
    },
    {
      title: "Assemble Components",
      description: "Assemble cut materials according to plan",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Drill", "Screws", "Hardware"],
      status: "not_started"
    },
    ...STANDARD_TASK_BLOCKS.verification,
    ...STANDARD_TASK_BLOCKS.documentation
  ],

  maintenance: [
    ...STANDARD_TASK_BLOCKS.planning,
    {
      title: "Inspect Equipment",
      description: "Thoroughly inspect equipment for wear and damage",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Flashlight", "Inspection Checklist"],
      status: "not_started"
    },
    {
      title: "Perform Maintenance",
      description: "Execute required maintenance procedures",
      phase: "execution",
      estimated_completion_date: undefined, 
      required_tools: ["Basic Tool Kit", "Lubricants"],
      status: "not_started"
    },
    {
      title: "Replace Worn Parts",
      description: "Replace any worn or damaged components",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Replacement Parts", "Tools"],
      status: "not_started"
    },
    ...STANDARD_TASK_BLOCKS.verification,
    ...STANDARD_TASK_BLOCKS.documentation
  ],

  repair: [
    ...STANDARD_TASK_BLOCKS.planning,
    {
      title: "Diagnose Issue",
      description: "Identify the root cause of the problem",
      phase: "execution", 
      estimated_completion_date: undefined,
      required_tools: ["Diagnostic Tools", "Multimeter"],
      status: "not_started"
    },
    {
      title: "Obtain Repair Parts",
      description: "Source and gather necessary repair materials",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Execute Repair",
      description: "Perform the necessary repair work",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Repair Tools", "Replacement Parts"],
      status: "not_started"
    },
    ...STANDARD_TASK_BLOCKS.verification,
    ...STANDARD_TASK_BLOCKS.documentation
  ],

  installation: [
    ...STANDARD_TASK_BLOCKS.planning,
    {
      title: "Prepare Installation Site",
      description: "Prepare the location for new equipment installation",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Cleaning Supplies", "Tools"],
      status: "not_started"
    },
    {
      title: "Install Equipment",
      description: "Install and position the new equipment",
      phase: "execution",
      estimated_completion_date: undefined, 
      required_tools: ["Installation Tools", "Hardware"],
      status: "not_started"
    },
    {
      title: "Connect Systems",
      description: "Connect electrical, plumbing, or other systems",
      phase: "execution",
      estimated_completion_date: undefined,
      required_tools: ["Electrical Tools", "Connectors"],
      status: "not_started"
    },
    ...STANDARD_TASK_BLOCKS.verification,
    ...STANDARD_TASK_BLOCKS.documentation
  ]
};

export function getStandardTasksForTemplate(templateId: string): StandardTask[] {
  return MISSION_TEMPLATES[templateId] || [
    ...STANDARD_TASK_BLOCKS.planning,
    ...STANDARD_TASK_BLOCKS.execution, 
    ...STANDARD_TASK_BLOCKS.verification,
    ...STANDARD_TASK_BLOCKS.documentation
  ];
}