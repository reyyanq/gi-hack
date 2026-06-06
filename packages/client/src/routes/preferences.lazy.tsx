import { useParams } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { apiPost } from '../lib/api';

export function PreferenceFormPage() {
  const params = useParams({ from: "/preferences/$contactId/$token" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const [formData, setFormData] = useState({
    consentGiven: false,
    preferredContactMethod: 'email' as 'email' | 'call' | 'both',
    interestLevel: 'medium' as 'high' | 'medium' | 'scheduling_only',
    areasOfInterest: [] as string[],
    timeline: '1-3_months' as 'immediate' | '1-3_months' | 'exploring',
    additionalNotes: ''
  });

  const areasOptions = [
    'Bulk proteins',
    'Antibodies',
    'Latex particles',
    'Blockers',
    'Custom formulation',
    'Quality documentation',
    'Regulatory support',
    'Supply chain reliability'
  ];

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await apiPost('/api/agents/preferences/validate', {
          contactId: params.contactId,
          token: params.token
        });

        if (res.ok && res.data.valid) {
          setTokenValid(true);
          setCompanyName(res.data.companyName);

          const interests = res.data.areasOfInterest || areasOptions.slice(0, 4);
          setFormData(prev => ({
            ...prev,
            areasOfInterest: interests
          }));
        } else {
          setTokenValid(false);
          setError('This link has expired or is invalid. Please contact us for a new link.');
        }
      } catch {
        setTokenValid(false);
        setError('Unable to validate your request. Please try again or contact support.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [params.contactId, params.token]);

  const handleAreaToggle = (area: string) => {
    setFormData(prev => ({
      ...prev,
      areasOfInterest: prev.areasOfInterest.includes(area)
        ? prev.areasOfInterest.filter(a => a !== area)
        : [...prev.areasOfInterest, area]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consentGiven) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await apiPost('/api/agents/preferences/submit', {
        contactId: params.contactId,
        token: params.token,
        ...formData
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error.message || 'Failed to submit preferences');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Preferences Confirmed</h1>
          <p className="text-slate-600 mb-6">Thank you! We'll be in touch soon based on your preferences.</p>
          <p className="text-sm text-slate-500 mb-8">Company: {companyName}</p>
          <div className="bg-slate-50 rounded-xl p-6 text-left">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">What happens next:</h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• A member of our team will review your preferences</li>
              <li>• You'll receive a follow-up email within 24-48 hours</li>
              <li>• We'll contact you via your preferred method</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-slate-50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Confirm Your Communication Preferences</h1>
            <p className="text-slate-600 mt-2">Siemens Healthineers Marburg</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent"
                  checked={formData.consentGiven}
                  onChange={(e) => setFormData(prev => ({ ...prev, consentGiven: e.target.checked }))}
                  className="mt-1.5 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  required
                />
                <label htmlFor="consent" className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold">I consent to receive follow-up communications</span> from Siemens Healthineers Marburg regarding biological intermediates, diagnostic reagents, and related services. This consent can be withdrawn at any time. By confirming, you agree to our privacy policy and terms of communication.
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Preferred Contact Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['email', 'call', 'both'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, preferredContactMethod: method }))}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      formData.preferredContactMethod === method
                        ? 'bg-blue-600 text-white border-2 border-blue-600'
                        : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {method === 'email' ? '📧 Email' : method === 'call' ? '📞 Phone Call' : '📱 Both'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Interest Level
              </label>
              <select
                value={formData.interestLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, interestLevel: e.target.value as any }))}
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900"
              >
                <option value="high">High - Ready to discuss partnership</option>
                <option value="medium">Medium - Exploring options</option>
                <option value="scheduling_only">Scheduling only - Initial consultation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Areas of Interest
              </label>
              <div className="grid grid-cols-2 gap-2">
                {areasOptions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => handleAreaToggle(area)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                      formData.areasOfInterest.includes(area)
                        ? 'bg-blue-100 text-blue-900 border-2 border-blue-600'
                        : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {formData.areasOfInterest.includes(area) && <span className="mr-1">✓</span>}
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Timeline
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['immediate', '1-3_months', 'exploring'] as const).map((timeline) => (
                  <button
                    key={timeline}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, timeline }))}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      formData.timeline === timeline
                        ? 'bg-blue-600 text-white border-2 border-blue-600'
                        : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {timeline === 'immediate' ? '🚀 Immediate' : timeline === '1-3_months' ? '📅 1-3 Months' : '🔍 Exploring'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={formData.additionalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                rows={3}
                placeholder="Any specific requirements, questions, or context you'd like to share..."
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 placeholder:text-slate-400 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!formData.consentGiven || submitting}
              className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? 'Submitting...' : 'Confirm Preferences'}
            </button>

            <p className="text-center text-xs text-slate-500">
              Siemens Healthineers © 2024 · Privacy Policy · Terms of Service
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}


