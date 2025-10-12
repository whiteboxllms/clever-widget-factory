import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Report, ReportSectionAssignment } from '@/types/report';

export const useReportData = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReport = async (reportId: string): Promise<Report | null> => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching report:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report",
        variant: "destructive",
      });
      return null;
    }
  };

  const createReport = async (reportData: Partial<Report>): Promise<Report | null> => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          name: reportData.name,
          run_frequency: reportData.run_frequency || 'manual',
          last_run: reportData.last_run
        } as any)
        .select()
        .single();

      if (error) throw error;

      await fetchReports();
      toast({
        title: "Success",
        description: "Report created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "Failed to create report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateReport = async (reportId: string, updates: Partial<Report>): Promise<void> => {
    try {
      const { error } = await supabase
        .from('reports')
        .update(updates)
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
      toast({
        title: "Success",
        description: "Report updated successfully",
      });
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Error",
        description: "Failed to update report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteReport = async (reportId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: "Error",
        description: "Failed to delete report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const addSectionsToReport = async (
    reportId: string, 
    sectionAssignments: Array<{ section_id: string; sort_order: number }>
  ): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const assignments = sectionAssignments.map(assignment => ({
        report_id: reportId,
        section_id: assignment.section_id,
        sort_order: assignment.sort_order,
        added_by: user.id
      }));

      const { error } = await supabase
        .from('report_section_assignments')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sections added to report successfully",
      });
    } catch (error) {
      console.error('Error adding sections to report:', error);
      toast({
        title: "Error",
        description: "Failed to add sections to report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeSectionFromReport = async (reportId: string, sectionId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('report_section_assignments')
        .delete()
        .eq('report_id', reportId)
        .eq('section_id', sectionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Section removed from report successfully",
      });
    } catch (error) {
      console.error('Error removing section from report:', error);
      toast({
        title: "Error",
        description: "Failed to remove section from report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateSectionOrder = async (
    reportId: string, 
    sectionOrders: Array<{ section_id: string; sort_order: number }>
  ): Promise<void> => {
    try {
      for (const order of sectionOrders) {
        const { error } = await supabase
          .from('report_section_assignments')
          .update({ sort_order: order.sort_order })
          .eq('report_id', reportId)
          .eq('section_id', order.section_id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Section order updated successfully",
      });
    } catch (error) {
      console.error('Error updating section order:', error);
      toast({
        title: "Error",
        description: "Failed to update section order",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getReportSections = async (reportId: string): Promise<ReportSectionAssignment[]> => {
    try {
      const { data, error } = await supabase
        .from('report_section_assignments')
        .select(`
          *,
          section:report_sections(*)
        `)
        .eq('report_id', reportId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching report sections:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report sections",
        variant: "destructive",
      });
      return [];
    }
  };

  const updateLastRun = async (reportId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ last_run: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating last run:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return {
    reports,
    isLoading,
    fetchReports,
    fetchReport,
    createReport,
    updateReport,
    deleteReport,
    addSectionsToReport,
    removeSectionFromReport,
    updateSectionOrder,
    getReportSections,
    updateLastRun,
  };
};
