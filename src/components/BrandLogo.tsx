type Props = {
  className?: string;
};

export function BrandLogo({ className = "h-12 w-auto rounded-md" }: Props) {
  return <img src={`${import.meta.env.BASE_URL}syntrex-logo.png`} alt="Syntrex Group Limited" className={className} />;
}
