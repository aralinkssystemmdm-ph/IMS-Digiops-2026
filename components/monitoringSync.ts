import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const syncSchoolMonitoringWithDRs = async (overrideDRs?: any[]) => {
  try {
    let receipts: any[] = [];
    let monitoringRecords: any[] = [];

    // 1. Load delivery receipts
    if (overrideDRs) {
      receipts = overrideDRs;
    } else {
      const drLocalStr = localStorage.getItem('aralinks_delivery_receipts') || '[]';
      let localReceipts: any[] = [];
      try {
        localReceipts = JSON.parse(drLocalStr);
      } catch {
        localReceipts = [];
      }

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('delivery_receipts')
            .select('*');
          if (!error && data) {
            // Convert database snake_case row names to camelCase states used by UI application
            receipts = data.map((row: any) => ({
              id: row.id,
              schoolName: row.school_name,
              clientCode: row.client_code,
              agent: row.agent,
              project: row.project,
              date: row.date,
              status: row.status === 'In transit' ? 'In Transit' : row.status,
              inTransitDate: row.in_transit_date,
              deliveredDate: row.delivered_date,
              totalItems: row.total_items,
              issuedBy: row.issued_by,
              deliveredBy: row.delivered_by,
              receivedBy: row.received_by,
              remarks: row.remarks,
              hardwareItems: typeof row.hardware_items === 'string' ? JSON.parse(row.hardware_items) : (row.hardware_items || []),
              serviceItems: typeof row.service_items === 'string' ? JSON.parse(row.service_items) : (row.service_items || []),
              signatoryPrepared: typeof row.signatory_prepared === 'string' ? JSON.parse(row.signatory_prepared) : row.signatory_prepared,
              signatoryApproved: typeof row.signatory_approved === 'string' ? JSON.parse(row.signatory_approved) : row.signatory_approved,
              signatoryDelivered: typeof row.signatory_delivered === 'string' ? JSON.parse(row.signatory_delivered) : row.signatory_delivered,
              signatoryCheckedReceived: typeof row.signatory_checked_received === 'string' ? JSON.parse(row.signatory_checked_received) : row.signatory_checked_received,
              address: row.address,
              contactPerson: row.contact_person,
              contactNo: row.contact_no,
              moa: row.moa,
              deliveryHistory: typeof row.delivery_history === 'string' ? JSON.parse(row.delivery_history) : (row.delivery_history || [])
            }));
          } else {
            receipts = localReceipts;
          }
        } catch (err) {
          console.warn('Could not load delivery receipts from Supabase, falling back to local:', err);
          receipts = localReceipts;
        }
      } else {
        receipts = localReceipts;
      }
    }

    // 2. Load school monitoring records
    const smLocalStr = localStorage.getItem('aralinks_school_monitoring') || '[]';
    let localMonitoring: any[] = [];
    try {
      localMonitoring = JSON.parse(smLocalStr);
    } catch {
      localMonitoring = [];
    }

    monitoringRecords = [...localMonitoring];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('school_monitoring')
          .select('*');
        if (!error && data) {
          const dbRecords = data.map((row: any) => {
            const parsedStatusDates = typeof row.status_dates === 'string' 
              ? JSON.parse(row.status_dates) 
              : (row.status_dates || { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' });

            return {
              id: row.id,
              customer_code: row.customer_code,
              school_name: row.school_name,
              program: row.program || '',
              sales_team: row.sales_team,
              class_opening: row.class_opening,
              target_deployment_date: row.target_deployment_date,
              status: Number(row.status) || 1,
              status_dates: parsedStatusDates,
              items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
              school_monitoring_id: row.school_monitoring_id || '',
              type_of_document: row.type_of_document || ''
            };
          });

          monitoringRecords = dbRecords;
          localStorage.setItem('aralinks_school_monitoring', JSON.stringify(dbRecords));
        }
      } catch (err) {
        console.warn('Could not load school monitoring records from Supabase, falling back to local:', err);
      }
    }

    if (monitoringRecords.length === 0) return;

    let itemRequestsList: any[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data: irData } = await supabase
          .from('item_requests')
          .select('school_monitoring_id, date, created_at, school_name')
          .not('status', 'in', '("Deleted","Rejected")');
        if (irData) {
          itemRequestsList = irData;
        }
      } catch (e) {
        console.warn('Failed to fetch item requests in monitoring sync:', e);
      }
    }

    let hasChanges = false;
    const recordsToUpsert: any[] = [];

    const updatedMonitoringRecords = monitoringRecords.map(record => {
      const schoolName = record.school_name;
      let recordChanged = false;
      let highestStatus = record.status; // Start with current status
      let targetDeploymentDate = record.target_deployment_date;
      const updatedDates = { ...record.status_dates };

      // 1. Match by school_monitoring_id in item_requests (Stage 3)
      if (record.school_monitoring_id) {
        const matchedIRs = itemRequestsList.filter(ir => 
          ir.school_monitoring_id && 
          ir.school_monitoring_id.trim().toUpperCase() === record.school_monitoring_id.trim().toUpperCase()
        );

        if (matchedIRs.length > 0) {
          const latestIR = matchedIRs.reduce((latest, current) => {
            const currentFullDate = current.date || current.created_at?.split('T')[0] || '';
            const latestFullDate = latest.date || latest.created_at?.split('T')[0] || '';
            return (!latestFullDate || currentFullDate > latestFullDate) ? current : latest;
          }, matchedIRs[0]);

          const creationDateVal = latestIR.date || latestIR.created_at?.split('T')[0] || '';
          if (creationDateVal && updatedDates[3] !== creationDateVal) {
            updatedDates[3] = creationDateVal;
            highestStatus = Math.max(highestStatus, 3);
            recordChanged = true;
          }
        }
      }

      // 2. Match by delivery receipts
      if (schoolName) {
        const schoolReceipts = receipts.filter(r => 
          (r.schoolName && r.schoolName.trim().toLowerCase() === schoolName.trim().toLowerCase()) ||
          (r.clientCode && record.customer_code && r.clientCode.trim().toLowerCase() === record.customer_code.trim().toLowerCase()) ||
          (r.schoolMonitoringId && record.school_monitoring_id && r.schoolMonitoringId.trim().toLowerCase() === record.school_monitoring_id.trim().toLowerCase()) ||
          (r.school_monitoring_id && record.school_monitoring_id && r.school_monitoring_id.trim().toLowerCase() === record.school_monitoring_id.trim().toLowerCase())
        );

        if (schoolReceipts.length > 0) {
          let inTransitDate = '';
          let deliveredDate = '';

          const transitDRs = schoolReceipts.filter(r => r.status?.toLowerCase() === 'in transit' || r.status?.toLowerCase() === 'partially delivered' || r.status?.toLowerCase() === 'delivered');
          if (transitDRs.length > 0) {
            const latestTransit = transitDRs.reduce((latest, r) => {
              const curDate = r.inTransitDate || r.date || '';
              return (!latest || curDate > latest) ? curDate : latest;
            }, '');
            if (latestTransit) inTransitDate = latestTransit;
          }

          const deliveredDRs = schoolReceipts.filter(r => r.status?.toLowerCase() === 'delivered');
          if (deliveredDRs.length > 0) {
            highestStatus = 7;
            const latestDelivered = deliveredDRs.reduce((latest, r) => {
              const curDate = r.deliveredDate || r.date || '';
              return (!latest || curDate > latest) ? curDate : latest;
            }, '');
            if (latestDelivered) deliveredDate = latestDelivered;
          } else if (transitDRs.length > 0) {
            highestStatus = Math.max(highestStatus, 6);
          }

          const latestTargetDR = schoolReceipts
            .filter(r => r.targetDeliveryDate)
            .reduce((latest, r) => (!latest || r.date > latest.date) ? r : latest, null as any);

          if (latestTargetDR && latestTargetDR.targetDeliveryDate && record.target_deployment_date !== latestTargetDR.targetDeliveryDate) {
            targetDeploymentDate = latestTargetDR.targetDeliveryDate;
            recordChanged = true;
          }

          if (highestStatus >= 6) {
            const finalTransitDate = inTransitDate || new Date().toISOString().split('T')[0];
            if (updatedDates[6] !== finalTransitDate) {
              updatedDates[6] = finalTransitDate;
              recordChanged = true;
            }
          }
          if (highestStatus >= 7) {
            const finalDelDate = deliveredDate || inTransitDate || new Date().toISOString().split('T')[0];
            if (updatedDates[7] !== finalDelDate) {
              updatedDates[7] = finalDelDate;
              recordChanged = true;
            }
          }
          if (highestStatus !== record.status) {
            recordChanged = true;
          }
        }
      }

      if (recordChanged || highestStatus !== record.status) {
        hasChanges = true;
        const updatedRec = {
          ...record,
          target_deployment_date: targetDeploymentDate,
          status: highestStatus,
          status_dates: updatedDates
        };
        recordsToUpsert.push(updatedRec);
        return updatedRec;
      }
      return record;
    });

    if (hasChanges) {
      localStorage.setItem('aralinks_school_monitoring', JSON.stringify(updatedMonitoringRecords));

      if (isSupabaseConfigured && recordsToUpsert.length > 0) {
        try {
          for (const rec of recordsToUpsert) {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rec.id || '');

            const dbPayload = {
              id: isUUID ? rec.id : undefined,
              customer_code: rec.customer_code,
              school_name: rec.school_name,
              program: rec.program || null,
              sales_team: rec.sales_team,
              class_opening: rec.class_opening,
              target_deployment_date: rec.target_deployment_date,
              status: rec.status,
              status_dates: rec.status_dates,
              items: rec.items,
              school_monitoring_id: rec.school_monitoring_id || null,
              type_of_document: rec.type_of_document || null,
              updated_at: new Date().toISOString()
            };

            await supabase
              .from('school_monitoring')
              .upsert(dbPayload, { onConflict: 'customer_code' });
          }
        } catch (err) {
          console.warn('Failed to upsert updated school monitoring records to Supabase:', err);
        }
      }
    }
  } catch (err) {
    console.warn('Error during auto-sync of monitoring data:', err);
  }
};
