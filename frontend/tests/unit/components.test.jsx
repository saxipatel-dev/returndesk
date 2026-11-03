import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { StatusBadge, TypeBadge } from "../../src/components/ui/Badge";
import { ConfirmDialog } from "../../src/components/ui/Modal";
import { EmptyState, ErrorState } from "../../src/components/ui/Feedback";
import { Pagination } from "../../src/components/ui/Layout";
import KpiRow from "../../src/components/charts/KpiRow";
import { MonthlyRequestsChart, StatusDonut } from "../../src/components/charts/Charts";
import RequestsTable from "../../src/components/requests/RequestsTable";
import Timeline from "../../src/components/requests/Timeline";
import StatusProgress from "../../src/components/requests/StatusProgress";

const sampleRequest = {
  id: 42,
  reference: "RD-00042",
  request_type: "return",
  status: "under_review",
  quantity: 1,
  reason: "defective",
  requested_resolution: "refund",
  product: { id: 1, sku: "EL-1", name: "Bluetooth Speaker", category: "Electronics" },
  order_number: "ORD-1001",
  customer: { id: 3, name: "Jordan Lee", email: "jordan@example.com", role: "customer" },
  assigned_employee: { id: 9, name: "Priya Raman", email: "priya@example.com", role: "employee" },
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
};

describe("badges", () => {
  it("shows human labels for statuses and types", () => {
    render(
      <>
        <StatusBadge status="pending_review" />
        <TypeBadge type="warranty" />
      </>,
    );
    expect(screen.getByText("Pending review")).toBeInTheDocument();
    expect(screen.getByText("Warranty")).toBeInTheDocument();
  });
});

describe("feedback states", () => {
  it("renders an empty state with its action", () => {
    render(<EmptyState title="No requests yet" action={<button>Start</button>} />);
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("lets the user retry after an error", async () => {
    const retry = vi.fn();
    render(<ErrorState message="Server unavailable" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("ConfirmDialog", () => {
  it("only confirms when the confirm button is pressed", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog open title="Reject this request?" confirmLabel="Reject" onConfirm={onConfirm} onClose={onClose}>
        <p>Are you sure?</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Reject this request?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Close?" onConfirm={() => {}} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(<ConfirmDialog open={false} title="Hidden" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("shows the visible range and moves between pages", async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageSize={10} total={25} onChange={onChange} />);
    expect(screen.getByRole("navigation")).toHaveTextContent("Showing 11–20 of 25");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("KpiRow", () => {
  it("shows N/A when there are no decisions or closed requests", () => {
    render(
      <KpiRow
        summary={{
          total_requests: 0,
          pending_review: 0,
          unassigned_open: 0,
          approved_decisions: 0,
          rejected_decisions: 0,
          approval_rate: null,
          avg_resolution_days: null,
        }}
      />,
    );
    expect(screen.getAllByText("N/A")).toHaveLength(2);
    expect(screen.getByText("No decisions yet")).toBeInTheDocument();
  });

  it("shows the rate and its denominator", () => {
    render(
      <KpiRow
        summary={{
          total_requests: 10,
          pending_review: 2,
          unassigned_open: 1,
          approved_decisions: 3,
          rejected_decisions: 1,
          approval_rate: 75,
          avg_resolution_days: 4.2,
        }}
      />,
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 of 4 decisions")).toBeInTheDocument();
    expect(screen.getByText("4.2 days")).toBeInTheDocument();
  });
});

describe("charts", () => {
  it("shows an empty state instead of a blank chart", () => {
    render(<MonthlyRequestsChart data={[{ month: "2026-01", count: 0 }]} />);
    expect(screen.getByText("No data for the selected filters.")).toBeInTheDocument();
  });

  it("includes a text summary and metric definition", () => {
    render(
      <StatusDonut
        data={[
          { status: "approved", count: 3 },
          { status: "rejected", count: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Requests grouped by their current status.")).toBeInTheDocument();
    expect(screen.getByText("Approved: 3, Rejected: 1")).toBeInTheDocument();
  });
});

describe("RequestsTable", () => {
  it("links each request and shows staff columns when asked", () => {
    render(
      <MemoryRouter>
        <RequestsTable items={[sampleRequest]} linkTo={(r) => `/staff/returns/${r.id}`} showCustomer showAssignee />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "RD-00042" })).toHaveAttribute("href", "/staff/returns/42");
    expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    expect(screen.getByText("Priya Raman")).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });
});

describe("Timeline and progress", () => {
  it("describes decisions and notes in order", () => {
    const actor = { id: 9, name: "Priya Raman", role: "employee" };
    render(
      <Timeline
        events={[
          { id: 1, event_type: "created", to_status: "pending_review", actor, created_at: "2026-10-01T10:00:00Z" },
          {
            id: 2,
            event_type: "decision",
            from_status: "under_review",
            to_status: "rejected",
            note: "Shows heavy wear.",
            actor,
            created_at: "2026-10-02T10:00:00Z",
          },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Request submitted");
    expect(items[1]).toHaveTextContent("Request rejected");
    expect(items[1]).toHaveTextContent("Shows heavy wear.");
  });

  it("marks a rejected decision in the progress bar", () => {
    render(<StatusProgress request={{ status: "rejected", decision: "rejected" }} />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});
