export interface StandardAction {
  title: string;
  description: string;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  status: 'not_started' | 'in_progress' | 'completed';
}

// Common action templates that can be used across all mission types
export const STANDARD_ACTIONS: StandardAction[] = [
  {
    title: "Site Assessment",
    description: "Evaluate the work area and identify potential challenges",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Resource Planning",
    description: "Identify and secure all required materials and tools",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Safety Planning",
    description: "Review safety requirements and prepare safety measures",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Prepare Work Area",
    description: "Set up work area and organize tools and materials",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Execute Primary Work",
    description: "Perform the main work activity",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Clean Up Work Area",
    description: "Clean and organize work area, return tools",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Quality Check",
    description: "Verify work meets specifications and standards",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Functionality Test",
    description: "Test that completed work functions as intended",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  },
  {
    title: "Photo Documentation",
    description: "Take before and after photos of the work",
    estimated_completion_date: undefined,
    required_tools: ["Camera/Phone"],
    status: "not_started"
  },
  {
    title: "Update Records",
    description: "Update maintenance logs and documentation",
    estimated_completion_date: undefined,
    required_tools: [],
    status: "not_started"
  }
];

// Mission-specific action templates
export const MISSION_TEMPLATES: Record<string, StandardAction[]> = {
  construction: [
    {
      title: "Site Assessment",
      description: "Evaluate the work area and identify potential challenges",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Resource Planning",
      description: "Identify and secure all required materials and tools",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Safety Planning",
      description: "Review safety requirements and prepare safety measures",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Measure and Mark",
      description: "Take accurate measurements and mark cutting/drilling points",
      estimated_completion_date: undefined,
      required_tools: ["Measuring Tape", "Pencil", "Level"],
      status: "not_started"
    },
    {
      title: "Cut Materials",
      description: "Cut materials to required dimensions",
      estimated_completion_date: undefined,
      required_tools: ["Saw", "Safety Equipment"],
      status: "not_started"
    },
    {
      title: "Assemble Components",
      description: "Assemble cut materials according to plan",
      estimated_completion_date: undefined,
      required_tools: ["Drill", "Screws", "Hardware"],
      status: "not_started"
    },
    {
      title: "Quality Check",
      description: "Verify work meets specifications and standards",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Functionality Test",
      description: "Test that completed work functions as intended",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Photo Documentation",
      description: "Take before and after photos of the work",
      estimated_completion_date: undefined,
      required_tools: ["Camera/Phone"],
      status: "not_started"
    },
    {
      title: "Update Records",
      description: "Update maintenance logs and documentation",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ],

  maintenance: [
    {
      title: "Site Assessment",
      description: "Evaluate the work area and identify potential challenges",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Resource Planning",
      description: "Identify and secure all required materials and tools",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Safety Planning",
      description: "Review safety requirements and prepare safety measures",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Inspect Equipment",
      description: "Thoroughly inspect equipment for wear and damage",
      estimated_completion_date: undefined,
      required_tools: ["Flashlight", "Inspection Checklist"],
      status: "not_started"
    },
    {
      title: "Perform Maintenance",
      description: "Execute required maintenance procedures",
      estimated_completion_date: undefined,
      required_tools: ["Basic Tool Kit", "Lubricants"],
      status: "not_started"
    },
    {
      title: "Replace Worn Parts",
      description: "Replace any worn or damaged components",
      estimated_completion_date: undefined,
      required_tools: ["Replacement Parts", "Tools"],
      status: "not_started"
    },
    {
      title: "Quality Check",
      description: "Verify work meets specifications and standards",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Functionality Test",
      description: "Test that completed work functions as intended",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Photo Documentation",
      description: "Take before and after photos of the work",
      estimated_completion_date: undefined,
      required_tools: ["Camera/Phone"],
      status: "not_started"
    },
    {
      title: "Update Records",
      description: "Update maintenance logs and documentation",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ],

  repair: [
    {
      title: "Site Assessment",
      description: "Evaluate the work area and identify potential challenges",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Resource Planning",
      description: "Identify and secure all required materials and tools",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Safety Planning",
      description: "Review safety requirements and prepare safety measures",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Diagnose Issue",
      description: "Identify the root cause of the problem",
      estimated_completion_date: undefined,
      required_tools: ["Diagnostic Tools", "Multimeter"],
      status: "not_started"
    },
    {
      title: "Obtain Repair Parts",
      description: "Source and gather necessary repair materials",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Execute Repair",
      description: "Perform the necessary repair work",
      estimated_completion_date: undefined,
      required_tools: ["Repair Tools", "Replacement Parts"],
      status: "not_started"
    },
    {
      title: "Quality Check",
      description: "Verify work meets specifications and standards",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Functionality Test",
      description: "Test that completed work functions as intended",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Photo Documentation",
      description: "Take before and after photos of the work",
      estimated_completion_date: undefined,
      required_tools: ["Camera/Phone"],
      status: "not_started"
    },
    {
      title: "Update Records",
      description: "Update maintenance logs and documentation",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ],

  installation: [
    {
      title: "Site Assessment",
      description: "Evaluate the work area and identify potential challenges",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Resource Planning",
      description: "Identify and secure all required materials and tools",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Safety Planning",
      description: "Review safety requirements and prepare safety measures",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Prepare Installation Site",
      description: "Prepare the location for new equipment installation",
      estimated_completion_date: undefined,
      required_tools: ["Cleaning Supplies", "Tools"],
      status: "not_started"
    },
    {
      title: "Install Equipment",
      description: "Install and position the new equipment",
      estimated_completion_date: undefined,
      required_tools: ["Installation Tools", "Hardware"],
      status: "not_started"
    },
    {
      title: "Connect Systems",
      description: "Connect electrical, plumbing, or other systems",
      estimated_completion_date: undefined,
      required_tools: ["Electrical Tools", "Connectors"],
      status: "not_started"
    },
    {
      title: "Quality Check",
      description: "Verify work meets specifications and standards",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Functionality Test",
      description: "Test that completed work functions as intended",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    },
    {
      title: "Photo Documentation",
      description: "Take before and after photos of the work",
      estimated_completion_date: undefined,
      required_tools: ["Camera/Phone"],
      status: "not_started"
    },
    {
      title: "Update Records",
      description: "Update maintenance logs and documentation",
      estimated_completion_date: undefined,
      required_tools: [],
      status: "not_started"
    }
  ]
};

export function getStandardActionsForTemplate(templateId: string): StandardAction[] {
  return MISSION_TEMPLATES[templateId] || STANDARD_ACTIONS;
}