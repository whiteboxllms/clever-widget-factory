import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReportSection } from '@/types/report';

export const useSections = () => {
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSections = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('report_sections')
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sections",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectionsByFocus = async (sectionFocus: string): Promise<ReportSection[]> => {
    try {
      const { data, error } = await supabase
        .from('report_sections')
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name)
        `)
        .eq('section_focus', sectionFocus)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sections by focus:', error);
      toast({
        title: "Error",
        description: `Failed to fetch ${sectionFocus} sections`,
        variant: "destructive",
      });
      return [];
    }
  };

  const fetchSectionsForReport = async (reportId: string): Promise<ReportSection[]> => {
    try {
      const { data, error } = await supabase
        .from('report_sections')
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name),
          assignments:report_section_assignments!inner(sort_order)
        `)
        .eq('assignments.report_id', reportId)
        .order('assignments.sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sections for report:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report sections",
        variant: "destructive",
      });
      return [];
    }
  };

  const fetchSectionsByDateRange = async (
    dateStart: string, 
    dateEnd: string
  ): Promise<ReportSection[]> => {
    try {
      const { data, error } = await supabase
        .from('report_sections')
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name)
        `)
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sections by date range:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sections for date range",
        variant: "destructive",
      });
      return [];
    }
  };

  const createSection = async (sectionData: Partial<ReportSection>): Promise<ReportSection | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('report_sections')
        .insert({
          section_focus: sectionData.section_focus,
          title: sectionData.title,
          report: sectionData.report,
          prompt_id: sectionData.prompt_id,
          created_by: user.id
        } as any)
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name)
        `)
        .single();

      if (error) throw error;

      await fetchSections();
      toast({
        title: "Success",
        description: "Section created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating section:', error);
      toast({
        title: "Error",
        description: "Failed to create section",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateSection = async (sectionId: string, updates: Partial<ReportSection>): Promise<void> => {
    try {
      const { error } = await supabase
        .from('report_sections')
        .update(updates)
        .eq('id', sectionId);

      if (error) throw error;

      await fetchSections();
      toast({
        title: "Success",
        description: "Section updated successfully",
      });
    } catch (error) {
      console.error('Error updating section:', error);
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteSection = async (sectionId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('report_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      await fetchSections();
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getSectionFocuses = (): string[] => {
    const focuses = new Set(sections.map(section => section.section_focus));
    return Array.from(focuses).sort();
  };

  const getSectionsByFocus = (focus: string): ReportSection[] => {
    return sections.filter(section => section.section_focus === focus);
  };

  const searchSections = (query: string): ReportSection[] => {
    const lowercaseQuery = query.toLowerCase();
    return sections.filter(section => 
      section.title.toLowerCase().includes(lowercaseQuery) ||
      section.section_focus.toLowerCase().includes(lowercaseQuery)
    );
  };

  const duplicateSection = async (sectionId: string): Promise<ReportSection | null> => {
    try {
      const originalSection = sections.find(s => s.id === sectionId);
      if (!originalSection) throw new Error('Section not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('report_sections')
        .insert({
          section_focus: originalSection.section_focus,
          title: `${originalSection.title} (Copy)`,
          report: originalSection.report,
          prompt_id: originalSection.prompt_id,
          created_by: user.id
        } as any)
        .select(`
          *,
          prompt:prompts(name, intended_usage),
          created_by_profile:profiles(full_name)
        `)
        .single();

      if (error) throw error;

      await fetchSections();
      toast({
        title: "Success",
        description: "Section duplicated successfully",
      });
      return data;
    } catch (error) {
      console.error('Error duplicating section:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate section",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  return {
    sections,
    isLoading,
    fetchSections,
    fetchSectionsByFocus,
    fetchSectionsForReport,
    fetchSectionsByDateRange,
    createSection,
    updateSection,
    deleteSection,
    getSectionFocuses,
    getSectionsByFocus,
    searchSections,
    duplicateSection,
  };
};
