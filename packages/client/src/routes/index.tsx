import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const COLORS = {
  background: "#0f1117",
  card: "#161b27",
  text: "#e0e0e0",
  subtext: "#888",
  accent: "#6366f1",
  accentDark: "#4f46e5",
  warning: "#f97316",
};

const TEAM = [
  { name: "Tobias", role: "Backend Pipeline", icon: "🛠️" },
  { name: "Reyyan", role: "Dashboard UI", icon: "🎨" },
  { name: "Beyza", role: "Pipeline CRM", icon: "📋" },
  { name: "Zeynep", role: "AI Layer", icon: "🤖" },
];

const FEATURES = [
  {
    icon: "📊",
    title: "12+ Data Sources",
    description: "FDA, clinical trials, patents, research, and more",
  },
  {
    icon: "🎯",
    title: "AI-Powered Scoring",
    description: "HOT/WARM/COLD tiers with 4-factor algorithm",
  },
  {
    icon: "📋",
    title: "Pipeline CRM",
    description: "Kanban board with stage management",
  },
  {
    icon: "✉️",
    title: "AI Outreach",
    description: "Generate personalized sales emails",
  },
];

function FlowDiagram() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      padding: "40px 0",
      flexWrap: "wrap",
    }}>
      {[
        { label: "Data Sources", color: "#6366f1" },
        { label: "Neo4j Graph", color: "#8b5cf6" },
        { label: "AI Scoring", color: "#f97316" },
        { label: "Leads", color: "#22c55e" },
      ].map((item, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            padding: "12px 24px",
            borderRadius: "12px",
            background: `linear-gradient(135deg, ${item.color}20, ${item.color}10)`,
            border: `1px solid ${item.color}40`,
            color: item.color,
            fontWeight: "600",
            fontSize: "14px",
            animation: `fadeInUp 0.6s ease ${idx * 0.15}s both`,
          }}>
            {item.label}
          </div>
          {idx < 3 && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" style={{
              animation: `pulse 2s ease-in-out infinite ${idx * 0.2}s`,
            }}>
              <path d="M5 12h14" strokeLinecap="round" />
              <path d="M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function HeroSection() {
  return (
    <section style={{
      padding: "80px 36px 60px",
      textAlign: "center",
      maxWidth: "900px",
      margin: "0 auto",
    }}>
      <h1 style={{
        fontSize: "48px",
        fontWeight: "700",
        color: COLORS.text,
        lineHeight: "1.1",
        marginBottom: "24px",
        letterSpacing: "-1px",
        animation: "fadeInDown 0.8s ease both",
      }}>
        AI-Powered B2B Lead Identification
        <br />
        <span style={{ color: COLORS.accent }}>for Industrial Suppliers</span>
      </h1>

      <p style={{
        fontSize: "18px",
        color: COLORS.subtext,
        lineHeight: "1.6",
        marginBottom: "40px",
        maxWidth: "700px",
        margin: "0 auto 40px",
        animation: "fadeInDown 0.8s ease 0.2s both opacity: 0",
      }}>
        LeadGraph turns regulatory signals into sales opportunities.
        <br />
        Built for Siemens Healthineers at <span style={{ color: COLORS.accent }}>StartMiUp Hackathon 2026</span>.
      </p>

      <div style={{
        display: "flex",
        gap: "16px",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        animation: "fadeInUp 0.8s ease 0.4s both",
      }}>
        <Link
          to="/dashboard"
          style={{
            padding: "16px 40px",
            borderRadius: "12px",
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`,
            color: "#fff",
            fontSize: "16px",
            fontWeight: "600",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: `0 4px 20px ${COLORS.accent}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 6px 24px ${COLORS.accent}60`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 4px 20px ${COLORS.accent}40`;
          }}
        >
          Explore the Dashboard
        </Link>

      </div>

      <FlowDiagram />
    </section>
  );
}

function ProblemSection() {
  return (
    <section style={{
      padding: "60px 36px",
      backgroundColor: "#13151a",
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "60px",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{
              fontSize: "32px",
              fontWeight: "700",
              color: COLORS.text,
              marginBottom: "20px",
            }}>
              The Problem
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "rgba(249, 115, 22, 0.1)",
                border: "1px solid rgba(249, 115, 22, 0.2)",
              }}>
                <div style={{
                  fontSize: "13px",
                  color: COLORS.warning,
                  fontWeight: "600",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  Company Reality
                </div>
                <p style={{
                  fontSize: "15px",
                  color: COLORS.text,
                  lineHeight: "1.6",
                  margin: "0",
                }}>
                  Siemens Healthineers produces biological intermediates at Marburg —
                  proteins, antibodies, latex particles, blockers
                </p>
              </div>

              <div style={{
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
              }}>
                <div style={{
                  fontSize: "13px",
                  color: COLORS.accent,
                  fontWeight: "600",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  The Gap
                </div>
                <p style={{
                  fontSize: "15px",
                  color: COLORS.text,
                  lineHeight: "1.6",
                  margin: "0",
                }}>
                  No systematic way to find diagnostic companies developing new assays that need these supplies
                </p>
              </div>

              <div style={{
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}>
                <div style={{
                  fontSize: "13px",
                  color: COLORS.subtext,
                  fontWeight: "600",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  Market Impact
                </div>
                <p style={{
                  fontSize: "15px",
                  color: COLORS.text,
                  lineHeight: "1.6",
                  margin: "0",
                }}>
                  <span style={{ color: COLORS.accent, fontWeight: "700" }}>$75B+</span> market,
                  thousands of companies, but <span style={{ color: COLORS.warning, fontWeight: "700" }}>zero</span> lead generation
                </p>
              </div>
            </div>
          </div>

          <div style={{
            fontSize: "96px",
            textAlign: "center",
            opacity: "0.1",
            lineHeight: "1",
          }}>
            ❓
          </div>
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section style={{
      padding: "80px 36px",
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{
          textAlign: "center",
          marginBottom: "60px",
        }}>
          <h2 style={{
            fontSize: "32px",
            fontWeight: "700",
            color: COLORS.text,
            marginBottom: "16px",
          }}>
            The Solution
          </h2>
          <p style={{
            fontSize: "17px",
            color: COLORS.subtext,
            lineHeight: "1.6",
            maxWidth: "600px",
            margin: "0 auto",
          }}>
            Neo4j knowledge graph that scans <span style={{ color: COLORS.accent, fontWeight: "600" }}>12+ public data sources</span> for buying intent signals
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "24px",
        }}>
          {FEATURES.map((feature, idx) => (
            <div
              key={idx}
              style={{
                padding: "24px",
                borderRadius: "16px",
                backgroundColor: COLORS.card,
                border: "1px solid " + "rgba(255,255,255,0.06)",
                textAlign: "center",
                transition: "all 0.3s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = COLORS.accent + "40";
                e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: "18px",
                fontWeight: "700",
                color: COLORS.text,
                marginBottom: "12px",
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: "14px",
                color: COLORS.subtext,
                lineHeight: "1.6",
                margin: "0",
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "60px",
          padding: "32px",
          borderRadius: "16px",
          background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))`,
          border: "1px solid rgba(99, 102, 241, 0.2)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "14px",
            color: COLORS.subtext,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "16px",
          }}>
            3-Phase Sales Funnel
          </div>
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
          }}>
            {["Discover", "Qualify", "Convert"].map((phase, idx) => (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }} key={idx}>
                <div style={{
                  padding: "12px 32px",
                  borderRadius: "12px",
                  background: COLORS.card,
                  border: "1px solid " + "rgba(255,255,255,0.1)",
                  color: COLORS.text,
                  fontSize: "16px",
                  fontWeight: "600",
                }}>
                  {phase}
                </div>
                {idx < 2 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.accent} strokeWidth="2">
                    <path d="M5 12h14" strokeLinecap="round" />
                    <path d="M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LegalSection() {
  return (
    <section style={{
      padding: "60px 36px",
      backgroundColor: "#13151a",
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{
          padding: "32px",
          borderRadius: "16px",
          background: "rgba(249, 115, 22, 0.05)",
          border: "1px solid rgba(249, 115, 22, 0.2)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(249, 115, 22, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}>
              ⚠️
            </div>
            <h2 style={{
              fontSize: "24px",
              fontWeight: "700",
              color: COLORS.warning,
              margin: "0",
            }}>
              Important Notice
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{
              fontSize: "15px",
              color: COLORS.text,
              lineHeight: "1.7",
              margin: "0",
            }}>
              <strong>Prototype Context:</strong> This software was built for the <span style={{ color: COLORS.accent }}>StartMiUp Hackathon 2026</span> as a demonstrative prototype.
            </p>

            <p style={{
              fontSize: "15px",
              color: COLORS.text,
              lineHeight: "1.7",
              margin: "0",
            }}>
              <strong>Demo-Only Data:</strong> The leads, companies, and data shown in this interface are for <span style={{ color: COLORS.warning, fontWeight: "700" }}>demonstration purposes only</span>. They are not validated business leads.
            </p>

            <p style={{
              fontSize: "15px",
              color: COLORS.text,
              lineHeight: "1.7",
              margin: "0",
            }}>
              <strong>Commercial Use:</strong> Any actual outreach, commercial use, or integration with Siemens Healthineers operations requires proper coordination with Siemens and establishment of a legal business framework.
            </p>

            <p style={{
              fontSize: "15px",
              color: COLORS.text,
              lineHeight: "1.7",
              margin: "0",
            }}>
              <strong>GDPR Compliance:</strong> Contacting any leads commercially requires strict compliance with GDPR regulations, proper consent management, and adherence to applicable data protection laws.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section style={{
      padding: "60px 36px",
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{
          textAlign: "center",
          marginBottom: "40px",
        }}>
          <h2 style={{
            fontSize: "32px",
            fontWeight: "700",
            color: COLORS.text,
            marginBottom: "16px",
          }}>
            Team & License
          </h2>
          <p style={{
            fontSize: "15px",
            color: COLORS.subtext,
            margin: "0",
          }}>
            Built with ❤️ for StartMiUp Hackathon 2026
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}>
          {TEAM.map((member, idx) => (
            <div
              key={idx}
              style={{
                padding: "20px",
                borderRadius: "12px",
                backgroundColor: COLORS.card,
                border: "1px solid " + "rgba(255,255,255,0.06)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                {member.icon}
              </div>
              <div style={{
                fontSize: "16px",
                fontWeight: "700",
                color: COLORS.text,
                marginBottom: "4px",
              }}>
                {member.name}
              </div>
              <div style={{
                fontSize: "13px",
                color: COLORS.subtext,
              }}>
                {member.role}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: "24px",
          borderRadius: "12px",
          backgroundColor: "rgba(99, 102, 241, 0.05)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "14px",
            color: COLORS.subtext,
            fontWeight: "600",
            marginBottom: "12px",
          }}>
            Open Source License
          </div>
          <div style={{
            fontSize: "15px",
            color: COLORS.text,
            marginBottom: "20px",
          }}>
            MIT License — Free to use, modify, and distribute
          </div>
          <a
            href="https://pretix.eu/startmiup/hackathon/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "12px 32px",
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`,
              color: "#fff",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🎟️ Register for Hackathon
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: "40px 36px",
      backgroundColor: "#0a0c12",
      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "24px",
        }}>
          <div>
            <div style={{
              fontSize: "14px",
              fontWeight: "700",
              color: COLORS.text,
              marginBottom: "8px",
            }}>
              LeadGraph
            </div>
            <div style={{
              fontSize: "12px",
              color: COLORS.subtext,
            }}>
              AI-Powered B2B Lead Identification
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: "24px",
          }}>
            <a
              href="https://github.com/tobias-weiss-ai/gi-hack"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "13px",
                color: COLORS.subtext,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.subtext;
              }}
            >
              GitHub
            </a>
            <a
              href="/presentation/pitch.md"
              download
              style={{
                fontSize: "13px",
                color: COLORS.subtext,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.subtext;
              }}
            >
              Pitch
            </a>
            <a
              href="https://pretix.eu/startmiup/hackathon/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "13px",
                color: COLORS.subtext,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.subtext;
              }}
            >
              Hackathon
            </a>
          </div>
        </div>

        <div style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.04)",
          paddingTop: "20px",
          textAlign: "center",
        }}>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            lineHeight: "1.6",
          }}>
            <strong>Disclaimer:</strong> This is a hackathon prototype for demonstration purposes only.
            Not production software. Built at <span style={{ color: COLORS.accent }}>StartMiUp Hackathon 2026</span>.<br />
            Licensed under <span style={{ color: COLORS.accent }}>MIT License</span>. © 2026 Hackathon Team.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.background }}>
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        a {
          transition: all 0.2s ease;
        }
      `}</style>

      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <LegalSection />
      <TeamSection />
      <Footer />
    </div>
  );
}
