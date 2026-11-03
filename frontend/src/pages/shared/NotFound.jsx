import { Compass } from "lucide-react";
import { useAuth, homePathFor } from "../../context/AuthContext";
import { LinkButton } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Feedback";

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={<LinkButton to={homePathFor(user)}>Go to dashboard</LinkButton>}
      >
        The page you're looking for doesn't exist or you don't have access to it.
      </EmptyState>
    </div>
  );
}
