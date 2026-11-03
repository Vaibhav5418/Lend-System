import '../../loadEnv.js';
import { query, closePool } from './index.js';

// ─── Demographics & Realistic Data Dictionaries ──────────────────────────────
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Advait', 'Kabir', 'Ananya', 'Diya', 'Ishita', 'Pooja', 'Priya',
  'Rohan', 'Vikram', 'Sanjay', 'Rajesh', 'Amit', 'Suresh', 'Ramesh', 'Sunil', 'Deepak',
  'Manoj', 'Ajay', 'Vijay', 'Alok', 'Manish', 'Gaurav', 'Sandeep', 'Neha', 'Ritu',
  'Sneha', 'Shweta', 'Swati', 'Ankita', 'Meera', 'Kavita', 'Sunita', 'Rekha', 'Anita',
  'Geeta', 'Seema', 'Preeti', 'Harpreet', 'Gurpreet', 'Balwinder', 'Jaspreet', 'Manpreet',
  'Prateek', 'Abhishek', 'Siddharth', 'Aditya', 'Harsh', 'Varun', 'Kunal', 'Chetan',
  'Mohit', 'Chirag', 'Bhavin', 'Jignesh', 'Nilesh', 'Paresh', 'Bhavesh', 'Ketan',
  'Tushar', 'Saurabh', 'Ashish', 'Pankaj', 'Sachin', 'Rahul', 'Aniket', 'Mayur',
  'Swapnil', 'Omkar', 'Rohit', 'Nitin', 'Sumit', 'Arvind', 'Anand', 'Bhupendra',
  'Chandresh', 'Dhaval', 'Dinesh', 'Girish', 'Hasmukh', 'Jagdish', 'Kalpesh', 'Lokesh',
  'Mukesh', 'Narendra', 'Paavan', 'Rakesh', 'Satish', 'Tarun', 'Umesh', 'Vipul',
  'Yash', 'Yogesh', 'Devendra', 'Kamlesh', 'Pravin', 'Ganesh', 'Kishore', 'Mahesh',
  'Naresh', 'Sharad', 'Subhash', 'Sunanda', 'Vandana', 'Rashmi', 'Smita', 'Aparna',
  'Radhika', 'Tanvi', 'Kritika', 'Bhavna', 'Archana', 'Nandini', 'Vaishali', 'Jyoti',
  'Divya', 'Shilpa', 'Pallavi', 'Madhuri', 'Deepali', 'Sheetal', 'Monika', 'Sonali',
  'Kiran', 'Sarita', 'Mamta', 'Chhaya', 'Alka', 'Sapna', 'Karuna', 'Laxmi', 'Usha',
  'Gita', 'Pushpa', 'Sharda', 'Kusum', 'Lata', 'Shashi', 'Shobha', 'Santosh', 'Manju',
  'Prem', 'Kailash', 'Brijesh', 'Ramakant', 'Shyam', 'Gopal', 'Madhav', 'Narayan',
  'Keshav', 'Govind', 'Vishnu', 'Murli', 'Balkrishna', 'Tribhuvan', 'Dhananjay', 'Hemant',
  'Prashant', 'Jayant', 'Shrikant', 'Shashikant', 'Aniruddh', 'Amol', 'Makarand', 'Chinmay',
  'Kaustubh', 'Tanmay', 'Mandar', 'Nachiket', 'Parag', 'Sameer', 'Shantanu', 'Shardul',
  'Shubham', 'Suhas', 'Swapnesh', 'Vinayak', 'Virendra', 'Bipin', 'Hitendra', 'Jayesh',
  'Manishankar', 'Pradeep', 'Pramod', 'Pravinchandra', 'Ravindra', 'Sudhir', 'Suraj'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Mehta', 'Gupta', 'Verma', 'Singh', 'Kumar', 'Rao', 'Reddy',
  'Nair', 'Iyer', 'Joshi', 'Bhat', 'Kulkarni', 'Deshmukh', 'Patil', 'Shinde', 'Chavan',
  'Pawar', 'More', 'Jadhav', 'Jain', 'Agarwal', 'Bansal', 'Mittal', 'Goyal', 'Singhal',
  'Garg', 'Maheshwari', 'Somani', 'Rathi', 'Shah', 'Modi', 'Doshi', 'Vora', 'Parekh',
  'Parikh', 'Merchant', 'Gandhi', 'Trivedi', 'Shukla', 'Mishra', 'Tiwari', 'Pandey',
  'Dubey', 'Chaubey', 'Mukherjee', 'Banerjee', 'Chatterjee', 'Ghosh', 'Das', 'Sen',
  'Roy', 'Dutta', 'Bose', 'Choudhury', 'Khan', 'Ahmed', 'Ali', 'Siddiqui', 'Qureshi',
  'Fernandes', 'D\'Souza', 'Pinto', 'Lobo', 'Pereira', 'Chopra', 'Malhotra', 'Kapoor',
  'Khanna', 'Arora', 'Bhatia', 'Sethi', 'Grover', 'Bhasin', 'Anand', 'Sahni', 'Walia',
  'Bhandari', 'Kashyap', 'Chauhan', 'Rathore', 'Solanki', 'Shekhawat', 'Tanwar', 'Bhati',
  'Sisodia', 'Rawat', 'Negi', 'Bisht', 'Khanduri', 'Bhatt', 'Pant', 'Nambiar', 'Menon',
  'Pillai', 'Kurup', 'Varma', 'Menon', 'Shetty', 'Hegde', 'Rai', 'Alva', 'Ballal',
  'Pai', 'Kamath', 'Shenoy', 'Prabhu', 'Kudva', 'Kini', 'Bhakta', 'Mallya'
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune',
  'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
  'Visakhapatnam', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Coimbatore', 'Agra', 'Madurai',
  'Nashik', 'Faridabad', 'Rajkot', 'Meerut', 'Varanasi', 'Aurangabad', 'Amritsar',
  'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Jabalpur', 'Gwalior', 'Vijayawada',
  'Jodhpur', 'Raipur', 'Kota', 'Chandigarh', 'Guwahati', 'Solapur', 'Mysore', 'Gurgaon',
  'Noida', 'Jalandhar', 'Mangalore', 'Dehradun', 'Bhubaneswar', 'Kolhapur', 'Udaipur',
  'Gandhinagar', 'Bhavnagar', 'Jamnagar', 'Ujjain', 'Belgaum', 'Salem', 'Tirunelveli', 'Warangal'
];

const COMPANY_PREFIXES = [
  'Apex', 'Shree', 'Mahalaxmi', 'Vardhman', 'Kalyan', 'Shalimar', 'Zenith', 'Nexus',
  'Pinnacle', 'Sterling', 'Omni', 'Vanguard', 'Sigma', 'Matrix', 'Kaveri', 'Godavari',
  'Ganga', 'Surya', 'Navkar', 'Arihant', 'Paras', 'Trimurti', 'Universal', 'Continental',
  'Falcon', 'Orient', 'Sudarshan', 'Prabhat', 'Pioneer', 'Dynamic', 'Radhey', 'Krishna',
  'Balaji', 'Tirupati', 'Swastik', 'Astra', 'Elite', 'Prime', 'Vertex', 'Crest',
  'Horizon', 'Paramount', 'Titan', 'Novus', 'Vivid', 'Beacon', 'Alpha', 'Radiant',
  'Imperial', 'Sapphire', 'Golden', 'Royal', 'Emerald', 'Ambica', 'Bharat', 'Hindustan'
];

const COMPANY_SUFFIXES = [
  'Logistics', 'Pharma', 'Enterprises', 'Industries', 'Infra', 'Textiles', 'Engineering',
  'Polymers', 'Agrotech', 'Solutions', 'Components', 'Packaging', 'Energy', 'Ventures',
  'Synthetics', 'Technologies', 'Steel & Alloys', 'Ceramics', 'Chemicals', 'Exports',
  'Holdings', 'AutoTech', 'Distributors', 'Fabricators', 'Castings', 'Electricals'
];

const BORROWER_NOTES = [
  'Working capital requirement for raw material inventory and supplier advances ahead of festival demand.',
  'Bridge loan facility against prime commercial property collateral pending institutional sanction.',
  'Machinery procurement finance for imported CNC milling equipment to service defence aerospace orders.',
  'Expansion capital for establishing an automated cold-chain logistics facility along state industrial corridor.',
  'Export order fulfillment financing backed by confirmed irrevocable letters of credit from European buyers.',
  'Trade receivables discount facility to bridge 90-day vendor payment cycles with Tier-1 automotive OEMs.',
  'Solar rooftop EPC contractor seeking short-term milestone funding for industrial installations.',
  'Pharma formulation manufacturer expanding sterile injectables capacity with cGMP compliant facility.',
  'Fast-growing consumer goods brand seeking debt to scale offline retail distribution across metro cities.',
  'Textile processing unit upgrading to zero-liquid discharge effluent treatment plant to meet regulatory standards.',
  'Packaging manufacturer financing high-speed 6-color flexographic printing machinery.',
  'Specialty chemicals manufacturer financing bulk intermediate chemical imports from East Asia.',
  'Infrastructure sub-contractor requiring performance bank guarantees and mobilization advance margin money.',
  'Precision auto components unit installing automated robotic inspection cells for electric vehicle orders.',
  'Food processing and export company financing seasonal mango pulp and spices procurement.',
  'Steel fabrication enterprise expanding manufacturing bay for pre-engineered building (PEB) structures.',
  'Commercial fleet operator acquiring 12 multi-axle freight trucks on lease-cum-hypothecation.',
  'Medical diagnostics chain expanding network across Tier-2 cities with modern MRI and CT equipment.',
  'Electrical panel and transformer manufacturer financing raw copper and CRGO steel bulk orders.',
  'Plastic injection moulding company financing multi-cavity precision dies for appliance manufacturers.'
];

const INVESTOR_NOTES = [
  'HNI investor allocating liquidity to high-yielding, asset-backed commercial real estate debt instruments.',
  'Family office seeking disciplined fixed-income returns with monthly interest payout and bullet principal.',
  'Corporate treasury surplus deployment into secured short-term commercial borrower portfolios.',
  'Senior executive investor seeking predictable quarterly yield with conservative loan-to-value coverage.',
  'Wealth management client seeking portfolio diversification across verified SME manufacturing borrowers.',
  'Promoter family investing idle dividends from listed enterprise into senior secured debt notes.',
  'NRI professional seeking currency-hedged rupee investment yielding 10-11% p.a. with monthly liquidity.',
  'Retired institutional treasurer looking for low-volatility income generation with collateralized security.',
  'Chartered Accountant managing private syndicate looking to co-invest in short-term trade finance tickets.',
  'Tech entrepreneur deploying proceeds from partial equity liquidity into structured debt instruments.',
  'Doctor family trust allocating ₹2 Cr across multiple borrower tranches with quarterly coupon distribution.',
  'Industrialist seeking alternative fixed-yield avenue offering higher returns than commercial bank deposits.'
];

const BORROWER_STAGES = [
  'NEW', 'CONTACTED', 'MEETING', 'DOCS_PENDING', 'VERIFIED', 'PROPOSED', 'APPROVED', 'DISBURSED'
];

const INVESTOR_STAGES = [
  'NEW', 'CONTACTED', 'MEETING', 'RATE_DISCUSSED', 'AGREEMENT_DONE', 'FUND_RECEIVED'
];

const SOURCES = ['Website', 'Referral', 'Walk-in', 'Social Media', 'Agent', 'Existing Client'];
const PRIORITIES = ['Hot', 'Warm', 'Cold'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const TURNOVER_OPTIONS = ['45 L', '75 L', '1.2 Cr', '1.8 Cr', '2.5 Cr', '3.5 Cr', '5 Cr', '8.5 Cr', '12 Cr', '18 Cr', '25 Cr', '40 Cr', '65 Cr', '100 Cr'];

const AGENT_LIST = [
  { id: 'AGT-001', name: 'Apex Capital Advisors' },
  { id: 'AGT-002', name: 'FinTrust Financial Solutions' },
  { id: 'AGT-003', name: 'Kavita Financial Services' },
  { id: 'AGT-004', name: 'Zenith Loan Syndicators' },
  { id: 'AGT-005', name: 'Bharat Wealth Partners' },
  { id: 'AGT-006', name: 'Matrix Commercial Finance' },
  { id: 'AGT-007', name: 'Pinnacle Credit Advisory' },
  { id: 'AGT-008', name: 'Vanguard Lending Partners' },
  { id: 'AGT-009', name: 'Paramount Corporate Advisors' },
  { id: 'AGT-010', name: 'TrueNorth Financial Brokers' },
  { id: 'AGT-011', name: 'Sterling Business Associates' },
  { id: 'AGT-012', name: 'BlueChip Loan Consultants' },
  { id: 'AGT-013', name: 'Prosperity Credit Solutions' },
  { id: 'AGT-014', name: 'Samruddhi Financial Planners' },
  { id: 'AGT-015', name: 'Navkar Loan Consultancy' },
  { id: 'AGT-016', name: 'Shree Krishna Capital' },
  { id: 'AGT-017', name: 'PrimeEdge Financial Services' },
  { id: 'AGT-018', name: 'Fortune FinServe' },
  { id: 'AGT-019', name: 'Optima Lending Advisors' },
  { id: 'AGT-020', name: 'Unified Credit Partners' },
];

const STAFF_NAMES = ['Amit Shah', 'Neha Kapoor', 'Rahul Verma', 'Vaibhav Soni', 'Akshay', ''];

// ─── Deterministic / Seeded Pseudo-Random Generator ──────────────────────────
// Ensures reproducibility while producing varied, high-quality realistic data
function createRng(seed = 123456789) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const random = createRng(42);

function pick(arr) {
  return arr[Math.floor(random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 1) {
  const val = min + random() * (max - min);
  return Number(val.toFixed(decimals));
}

// ─── Seeder Logic ────────────────────────────────────────────────────────────
export async function seedDatabase(targetCount = 10000) {
  console.log(`Starting generation of approximately ${targetCount.toLocaleString()} records...`);

  // 1. Seed Agents table if empty or ensure agents exist
  console.log('Ensuring reference agents exist in agents table...');
  for (const ag of AGENT_LIST) {
    await query(
      `INSERT INTO agents (id, name, total_inquiries, conversions)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [ag.id, ag.name]
    );
  }
  console.log(`Seeded ${AGENT_LIST.length} agent partners.`);

  // 2. Determine highest existing inquiry number
  const maxRes = await query(
    `SELECT MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)) AS max_num FROM inquiries WHERE id ~ '^INQ-[0-9]+$'`
  );
  const currentMax = maxRes.rows[0]?.max_num || 0;
  console.log(`Current highest inquiry ID in database: INQ-${String(currentMax).padStart(3, '0')}`);

  const startIdNum = currentMax + 1;
  const endIdNum = currentMax + targetCount;
  console.log(`Generating inquiries from INQ-${String(startIdNum).padStart(3, '0')} to INQ-${String(endIdNum).padStart(3, '0')}...`);

  // Track uniquely generated phones and emails to guarantee zero duplicates
  const phoneSet = new Set();
  const emailSet = new Set();

  // Pre-load existing emails and mobiles from database to avoid any collision
  const existingContacts = await query(`SELECT mobile, email FROM inquiries`);
  for (const r of existingContacts.rows) {
    if (r.mobile) phoneSet.add(r.mobile.trim());
    if (r.email) emailSet.add(r.email.trim().toLowerCase());
  }

  // Generate unique Indian phone number (+91 6xxxx, 7xxxx, 8xxxx, 9xxxx)
  let phoneCounter = 9100000000;
  function getUniqueMobile() {
    while (phoneCounter < 9999999999) {
      phoneCounter++;
      const candidate = `+91 ${phoneCounter.toString().slice(0, 5)} ${phoneCounter.toString().slice(5)}`;
      if (!phoneSet.has(candidate)) {
        phoneSet.add(candidate);
        return candidate;
      }
    }
    // Fallback series
    const fallback = `+91 8${randInt(100000000, 999999999)}`;
    phoneSet.add(fallback);
    return fallback;
  }

  // Pre-generate records in memory
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(targetCount / BATCH_SIZE);

  // Time window: spread records across May 2025 to November 2026
  const minTime = new Date('2025-05-01T08:00:00.000Z').getTime();
  const maxTime = new Date('2026-11-01T18:00:00.000Z').getTime();

  let insertedCount = 0;
  const startTime = Date.now();

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = startIdNum + batchIdx * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endIdNum);
    const countInBatch = batchEnd - batchStart + 1;

    const ids = [];
    const types = [];
    const names = [];
    const mobiles = [];
    const emails = [];
    const cities = [];
    const sources = [];
    const priorities = [];
    const assignedTos = [];
    const referenceAgents = [];
    const stages = [];
    const nextFollowUps = [];
    const turnovers = [];
    const lastActivities = [];
    const lastActivityAts = [];
    const createdAts = [];
    const notesArr = [];
    const activityLogsArr = [];
    const profileScores = [];
    const profileScoreRatings = [];
    const borrowerDetailsArr = [];
    const investorDetailsArr = [];

    for (let idNum = batchStart; idNum <= batchEnd; idNum++) {
      const id = `INQ-${String(idNum).padStart(3, '0')}`;
      const isBorrower = random() < 0.68; // ~68% Borrowers, ~32% Investors
      const type = isBorrower ? 'Borrower' : 'Investor';

      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const mobile = getUniqueMobile();

      // Ensure 100% unique realistic email
      const companySlug = `${pick(COMPANY_PREFIXES).toLowerCase()}${pick(COMPANY_SUFFIXES).toLowerCase()}`.replace(/[^a-z]/g, '');
      const emailDomain = random() < 0.35 ? 'gmail.com' : random() < 0.55 ? 'outlook.com' : `${companySlug}.in`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${idNum}@${emailDomain}`;
      emailSet.add(email);

      const city = pick(CITIES);
      const source = pick(SOURCES);
      const priority = pick(PRIORITIES);
      const assignedTo = pick(STAFF_NAMES);
      const refAgent = source === 'Agent' ? pick(AGENT_LIST).name : null;

      // Realistic Stage Distribution
      let stage;
      if (isBorrower) {
        const roll = random();
        if (roll < 0.22) stage = 'NEW';
        else if (roll < 0.40) stage = 'CONTACTED';
        else if (roll < 0.55) stage = 'MEETING';
        else if (roll < 0.68) stage = 'DOCS_PENDING';
        else if (roll < 0.78) stage = 'VERIFIED';
        else if (roll < 0.88) stage = 'PROPOSED';
        else if (roll < 0.94) stage = 'APPROVED';
        else stage = 'DISBURSED';
      } else {
        const roll = random();
        if (roll < 0.25) stage = 'NEW';
        else if (roll < 0.45) stage = 'CONTACTED';
        else if (roll < 0.65) stage = 'MEETING';
        else if (roll < 0.80) stage = 'RATE_DISCUSSED';
        else if (roll < 0.90) stage = 'AGREEMENT_DONE';
        else stage = 'FUND_RECEIVED';
      }

      // Dates & Activity Logs
      const createdAtMs = minTime + (idNum / targetCount) * (maxTime - minTime) + randInt(-86400000, 86400000);
      const createdAt = new Date(Math.min(Math.max(createdAtMs, minTime), maxTime));

      const logs = [
        {
          action: 'Inquiry created',
          newStage: 'NEW',
          changedAt: createdAt.toISOString(),
        },
      ];

      const stageList = isBorrower ? BORROWER_STAGES : INVESTOR_STAGES;
      const stageIdx = stageList.indexOf(stage);

      let lastActivityAt = createdAt;
      let lastActivity = 'Inquiry created';

      if (stageIdx > 0) {
        const timeSpan = Date.now() - createdAt.getTime();
        const stepTime = Math.floor(timeSpan / (stageIdx + 1));

        for (let i = 1; i <= stageIdx; i++) {
          const stepStage = stageList[i];
          const prevStage = stageList[i - 1];
          const logDate = new Date(createdAt.getTime() + stepTime * i + randInt(3600000, 18000000));
          lastActivityAt = logDate;

          let actionDescription;
          switch (stepStage) {
            case 'CONTACTED':
              actionDescription = 'Stage changed from NEW to CONTACTED - initial phone consultation completed';
              break;
            case 'MEETING':
              actionDescription = 'Stage changed to MEETING - commercial terms and financial requirements reviewed';
              break;
            case 'DOCS_PENDING':
              actionDescription = 'Stage changed to DOCS_PENDING - requested 2-yr ITR, balance sheets, and 6-mo bank statements';
              break;
            case 'VERIFIED':
              actionDescription = 'Stage changed to VERIFIED - legal title and credit checks completed';
              break;
            case 'PROPOSED':
              actionDescription = `Proposal term sheet sent for borrower acceptance`;
              break;
            case 'APPROVED':
              actionDescription = 'Credit committee sanction approved and communicated';
              break;
            case 'DISBURSED':
              actionDescription = 'Loan disbursed and repayment schedule activated';
              break;
            case 'RATE_DISCUSSED':
              actionDescription = 'Investor yield, tenure, and payout frequency finalized';
              break;
            case 'AGREEMENT_DONE':
              actionDescription = 'Investor agreement executed and KYC acknowledged';
              break;
            case 'FUND_RECEIVED':
              actionDescription = 'Investment funds credited and allocation confirmed';
              break;
            default:
              actionDescription = `Stage changed from ${prevStage} to ${stepStage}`;
          }

          logs.push({
            action: actionDescription,
            oldStage: prevStage,
            newStage: stepStage,
            changedAt: logDate.toISOString(),
          });
          lastActivity = actionDescription;
        }
      }

      // Next follow up
      let nextFollowUp = null;
      if (['NEW', 'CONTACTED', 'MEETING', 'DOCS_PENDING', 'RATE_DISCUSSED'].includes(stage)) {
        const followDate = new Date(lastActivityAt.getTime() + randInt(2, 14) * 86400000);
        nextFollowUp = followDate.toISOString().slice(0, 10);
      }

      // Borrower vs Investor specific details
      let turnover = null;
      let borrowerDetails = null;
      let investorDetails = null;
      let notes = '';

      if (isBorrower) {
        turnover = pick(TURNOVER_OPTIONS);
        notes = pick(BORROWER_NOTES);

        // Loan amount correlated with turnover
        const amountOptions = [
          500000, 1000000, 1500000, 2500000, 3500000, 5000000, 7500000,
          10000000, 15000000, 25000000, 50000000, 100000000
        ];
        const loanAmount = pick(amountOptions);
        const tenure = pick([6, 12, 18, 24, 36, 48, 60]);
        const proposedInterest = randFloat(12.0, 20.5, 1);

        borrowerDetails = JSON.stringify({
          loanAmount,
          tenure,
          proposedInterest,
        });
      } else {
        notes = pick(INVESTOR_NOTES);
        const investOptions = [
          1000000, 2500000, 5000000, 10000000, 20000000, 30000000, 50000000, 100000000
        ];
        const investmentAmount = pick(investOptions);
        const tenure = pick([6, 12, 18, 24, 36]);
        const expectedInterest = randFloat(7.5, 12.0, 1);
        const frequency = pick(FREQUENCIES);

        investorDetails = JSON.stringify({
          investmentAmount,
          expectedInterest,
          tenure,
          frequency,
        });
      }

      // Profile score
      let profileScore = null;
      let profileScoreRating = null;
      if (['VERIFIED', 'PROPOSED', 'APPROVED', 'DISBURSED', 'AGREEMENT_DONE', 'FUND_RECEIVED'].includes(stage)) {
        profileScore = randInt(650, 880);
        if (profileScore >= 800) profileScoreRating = 'Excellent';
        else if (profileScore >= 720) profileScoreRating = 'Good';
        else profileScoreRating = 'Average';
      }

      // Push to arrays for batch insert
      ids.push(id);
      types.push(type);
      names.push(fullName);
      mobiles.push(mobile);
      emails.push(email);
      cities.push(city);
      sources.push(source);
      priorities.push(priority);
      assignedTos.push(assignedTo);
      referenceAgents.push(refAgent);
      stages.push(stage);
      nextFollowUps.push(nextFollowUp);
      turnovers.push(turnover);
      lastActivities.push(lastActivity);
      lastActivityAts.push(lastActivityAt.toISOString());
      createdAts.push(createdAt.toISOString());
      notesArr.push(notes);
      activityLogsArr.push(JSON.stringify(logs));
      profileScores.push(profileScore);
      profileScoreRatings.push(profileScoreRating);
      borrowerDetailsArr.push(borrowerDetails);
      investorDetailsArr.push(investorDetails);
    }

    // Execute PostgreSQL unnest batch insert
    const insertSql = `
      INSERT INTO inquiries (
        id, type, name, mobile, email, city, source, priority, assigned_to,
        reference_agent, stage, next_follow_up, turnover, last_activity,
        last_activity_at, created_at, notes, activity_logs,
        profile_score, profile_score_rating, borrower_details, investor_details
      )
      SELECT
        u.id, u.type, u.name, u.mobile, u.email, u.city, u.source, u.priority, u.assigned_to,
        u.reference_agent, u.stage, u.next_follow_up, u.turnover, u.last_activity,
        u.last_activity_at, u.created_at, u.notes, u.activity_logs::jsonb,
        u.profile_score, u.profile_score_rating, u.borrower_details::jsonb, u.investor_details::jsonb
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[], $7::varchar[], $8::varchar[], $9::varchar[],
        $10::varchar[], $11::varchar[], $12::varchar[], $13::varchar[], $14::varchar[],
        $15::timestamptz[], $16::timestamptz[], $17::text[], $18::text[],
        $19::numeric[], $20::varchar[], $21::text[], $22::text[]
      ) AS u(
        id, type, name, mobile, email, city, source, priority, assigned_to,
        reference_agent, stage, next_follow_up, turnover, last_activity,
        last_activity_at, created_at, notes, activity_logs,
        profile_score, profile_score_rating, borrower_details, investor_details
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    await query(insertSql, [
      ids, types, names, mobiles, emails, cities, sources, priorities, assignedTos,
      referenceAgents, stages, nextFollowUps, turnovers, lastActivities,
      lastActivityAts, createdAts, notesArr, activityLogsArr,
      profileScores, profileScoreRatings, borrowerDetailsArr, investorDetailsArr
    ]);

    insertedCount += countInBatch;
    const pct = ((insertedCount / targetCount) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Batch ${batchIdx + 1}/${totalBatches}] Inserted ${countInBatch} records (Total: ${insertedCount.toLocaleString()}/${targetCount.toLocaleString()} - ${pct}%) in ${elapsed}s`);
  }

  // Update Agent statistics
  console.log('Updating agent referral statistics...');
  await query(`
    UPDATE agents a
    SET
      total_inquiries = sub.total_inqs,
      conversions = sub.total_convs
    FROM (
      SELECT
        reference_agent,
        COUNT(*) AS total_inqs,
        COUNT(*) FILTER (WHERE stage IN ('APPROVED', 'DISBURSED', 'AGREEMENT_DONE', 'FUND_RECEIVED')) AS total_convs
      FROM inquiries
      WHERE reference_agent IS NOT NULL AND reference_agent <> ''
      GROUP BY reference_agent
    ) sub
    WHERE a.name = sub.reference_agent
  `);

  const finalTotal = await query(`SELECT COUNT(*) FROM inquiries`);
  console.log(`\n======================================================`);
  console.log(`SUCCESS: Added ${insertedCount.toLocaleString()} records!`);
  console.log(`Total inquiries in database now: ${Number(finalTotal.rows[0].count).toLocaleString()}`);
  console.log(`Total time elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`======================================================\n`);
}

// Auto-run if executed directly via node
if (process.argv[1]?.endsWith('seedInquiries.js')) {
  seedDatabase(10000)
    .catch((err) => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    })
    .finally(() => closePool());
}
