import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ScanReport } from '@shared/types';

export interface SupabaseState {
  syncing: boolean;
  syncError: string | null;
}

export async function persistReport(report: ScanReport): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase!.from('scan_reports').upsert(
    {
      id: report.id,
      repo_name: report.repoName,
      repo_url: report.repoUrl || null,
      branch: report.branch || null,
      timestamp: report.timestamp,
      duration: report.duration,
      status: report.status,
      error: report.error || null,
      score_percentage: report.score.percentage,
      total_checks: report.totalChecks,
      passed_checks: report.passedChecks,
      failed_checks: report.failedChecks,
      warning_checks: report.warningChecks,
      raw_report: report,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Supabase persistReport error:', error);
    throw error;
  }
}

export async function persistHistory(report: ScanReport): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase!.from('scan_history').insert({
    report_id: report.id,
    repo_name: report.repoName,
    score: report.score.percentage,
    status: report.status,
    timestamp: report.timestamp,
  });

  if (error) {
    console.error('Supabase persistHistory error:', error);
  }
}

export async function loadHistory(limit = 50): Promise<ScanReport[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase!
    .from('scan_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase loadHistory error:', error);
    return [];
  }

  return (data || [])
    .filter((r) => r.raw_report)
    .map((r) => r.raw_report as unknown as ScanReport);
}

export async function loadReport(id: string): Promise<ScanReport | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase!
    .from('scan_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data?.raw_report) return null;
  return data.raw_report as unknown as ScanReport;
}

export async function deleteReport(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await supabase!.from('scan_reports').delete().eq('id', id);
  await supabase!.from('scan_history').delete().eq('report_id', id);
}
