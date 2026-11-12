import { getMissingEvidenceTypes, getRequiredEvidenceTypes } from '@/utils/evidence'
import { formatFullDate } from '@/utils/format'

export const PRIORITY_META = {
  high: {
    label: 'High priority',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  medium: {
    label: 'Medium priority',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  low: {
    label: 'Low priority',
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
}

export const RECOMMENDATION_STYLES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
}

export function getRecommendation(dispute) {
  if (dispute.status === 'won') {
    return {
      tone: 'emerald',
      title: 'Closed in your favor',
      body: `PayPal resolved this case on ${formatFullDate(dispute.resolvedAt)} after reviewing the submitted evidence.`,
    }
  }

  if (dispute.status === 'lost') {
    return {
      tone: 'rose',
      title: 'Case closed against you',
      body: `This dispute was decided on ${formatFullDate(dispute.resolvedAt)}. Review the evidence you submitted to strengthen future responses.`,
    }
  }

  const missing = dispute.evidence.required - dispute.evidence.uploaded

  if (missing > 0) {
    const missingItems = getMissingEvidenceTypes(dispute)
    const suggestions = missingItems
      .slice(0, 2)
      .map((item) => item.toLowerCase())
      .join(' or ')

    return {
      tone: 'amber',
      title: 'Evidence gap detected',
      body: `${missing} required evidence item${missing === 1 ? '' : 's'} still missing. Add ${suggestions} before submitting your response.`,
    }
  }

  return {
    tone: 'sky',
    title: 'Strong defense available',
    body: 'Order and delivery records are complete. Submit a concise response before the deadline to keep the strongest position.',
  }
}

export function buildDraft(dispute) {
  const firstName = dispute.buyer.name.split(' ')[0]
  const uploaded = dispute.evidence.completed?.length
    ? dispute.evidence.completed
    : getRequiredEvidenceTypes(dispute).slice(0, dispute.evidence.uploaded)
  const evidenceLine = uploaded.length
    ? `We have attached the ${uploaded.join(', ').toLowerCase()} for PayPal's review.`
    : 'We are gathering the supporting order records for this case.'

  return `Hi ${firstName},

Thank you for contacting us about order ${dispute.orderId}. We have reviewed transaction ${dispute.transactionId} and your concern regarding ${dispute.reason.toLowerCase()}.

Our records show that this order was processed and fulfilled as described at checkout. ${evidenceLine}

We are happy to help resolve any remaining concern directly. Please reply with any additional details.

Best regards,
Acme Commerce Support`
}

export function getActivity(dispute) {
  return [
    {
      label: 'Dispute opened',
      date: formatFullDate(dispute.openedAt),
      dot: 'bg-slate-300',
    },
    dispute.status === 'open'
      ? {
          label: 'Response due',
          date: formatFullDate(dispute.dueAt),
          dot: 'bg-amber-500',
        }
      : {
          label: dispute.status === 'won' ? 'Dispute won' : 'Dispute lost',
          date: formatFullDate(dispute.resolvedAt),
          dot: dispute.status === 'won' ? 'bg-emerald-500' : 'bg-rose-500',
        },
  ]
}
