const SUPABASE_URL = "https://flwzzvrouurpmhmlecol.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rD5Se89VFRShLP60k2M9Bw_ZpAJjDBR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

function isNumericId(id) {
  return id !== null && id !== undefined && /^\d+$/.test(String(id));
}

let nextGeneratedId = Date.now();

function numericIdOrNew(id) {
  return isNumericId(id) ? Number(id) : nextGeneratedId++;
}

function projectFromState(project) {
  const technologies = String(project.tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  const record = {
    title: project.title || '',
    description: project.desc || '',
    technologies,
    github_url: project.githubUrl || project.url || null,
    live_url: project.liveUrl || null,
    image_url: project.imageUrl || null,
    featured: Boolean(project.featured)
  };
  record.id = numericIdOrNew(project.id);
  return record;
}

function projectToState(project) {
  return {
    id: String(project.id),
    title: project.title || '',
    tags: Array.isArray(project.technologies) ? project.technologies.join(', ') : '',
    desc: project.description || '',
    url: project.github_url || project.live_url || '#',
    githubUrl: project.github_url || '',
    liveUrl: project.live_url || '',
    imageUrl: project.image_url || '',
    featured: Boolean(project.featured)
  };
}

function certificateToState(certificate) {
  return {
    id: String(certificate.id),
    title: certificate.title || '',
    issuer: certificate.issuer || '',
    date: certificate.issue_date || certificate.verification_details || 'Verified',
    certificateUrl: certificate.certificate_url || ''
  };
}

function internshipToState(item) {
  return {
    id: String(item.id),
    role: item.role || '',
    company: item.company || '',
    period: item.period || '',
    desc: item.description || ''
  };
}

function researchToState(item) {
  return {
    id: String(item.id),
    title: item.title || '',
    venue: item.venue || '',
    year: item.year || '',
    authors: item.authors || '',
    abstract: item.abstract || '',
    link: item.link || ''
  };
}

function bookToState(item) {
  return {
    id: String(item.id),
    title: item.title || '',
    publisher: item.publisher || '',
    synopsis: item.synopsis || '',
    url: item.url || ''
  };
}

async function selectOwnedRows(table, userId) {
  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .eq('owner_id', userId);
  if (error) throw error;
  return data || [];
}

async function loadPortfolioData(userId = null) {
  let portfolioQuery = supabaseClient.from('portfolio').select('*');
  if (userId) {
    portfolioQuery = portfolioQuery.eq('owner_id', userId).maybeSingle();
  } else {
    portfolioQuery = portfolioQuery.limit(1);
  }
  const { data: portfolioResult, error: portfolioError } = await portfolioQuery;
  if (portfolioError) throw portfolioError;

  const portfolio = userId
    ? portfolioResult || null
    : portfolioResult && portfolioResult[0] ? portfolioResult[0] : null;
  const ownerId = portfolio ? portfolio.owner_id : userId;
  const [projects, skills, certificates, education, research, internships, books] = await Promise.all([
    selectOwnedRows('projects', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('skills', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('certificates', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('education', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('research', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('internships', ownerId || '00000000-0000-0000-0000-000000000000'),
    selectOwnedRows('books', ownerId || '00000000-0000-0000-0000-000000000000')
  ]);

  return { portfolio, projects, skills, certificates, education, research, internships, books };
}

async function upsertRows(table, rows, userId, mapper) {
  const records = rows.map(row => {
    const record = mapper(row);
    if (!isNumericId(row.id) && record.id !== undefined) row.id = String(record.id);
    return Object.assign(record, { owner_id: userId });
  });
  if (!records.length) return;
  const { error } = await supabaseClient.from(table).upsert(records, { onConflict: 'id' });
  if (error) throw error;
}

async function deleteMissingRows(table, rows, userId) {
  const numericIds = rows.filter(row => isNumericId(row.id)).map(row => Number(row.id));
  const query = supabaseClient.from(table).delete().eq('owner_id', userId);
  const { error } = numericIds.length
    ? await query.not('id', 'in', `(${numericIds.join(',')})`)
    : await query;
  if (error) throw error;
}

async function savePortfolioData(state, userId) {
  if (!Array.isArray(state.education)) {
    state.education = [{
      degree: state.summary && state.summary.degree || '',
      institution: state.summary && state.summary.university || '',
      startYear: null,
      endYear: null,
      cgpa: null
    }];
  }
  const { data: existingPortfolio, error: existingPortfolioError } = await supabaseClient
    .from('portfolio')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (existingPortfolioError) throw existingPortfolioError;

  const portfolio = Object.assign({
    id: existingPortfolio ? existingPortfolio.id : numericIdOrNew(null),
    name: state.name || '',
    email: state.email || '',
    location: state.summary && state.summary.location || '',
    about: state.fullBio || '',
    profile_image: state.avatarUrl || '',
    resume_url: state.socials && state.socials.resume || '',
    hero_title: state.heroTitle || '',
    tagline: state.tagline || '',
    badge_text: state.badgeText || '',
    short_bio: state.shortBio || '',
    github_url: state.socials && state.socials.github || '',
    linkedin_url: state.socials && state.socials.linkedin || '',
    scholar_url: state.socials && state.socials.scholar || '',
    bio_heading: state.bioHeading || '',
    selected_font: state.selectedFont || 'Ubuntu',
    custom_text: state.customText || {},
    section_text: state.sectionText || {},
    owner_id: userId
  }, existingPortfolio ? { id: existingPortfolio.id } : {});

  const portfolioWrite = existingPortfolio
    ? supabaseClient.from('portfolio').update(portfolio).eq('id', existingPortfolio.id).eq('owner_id', userId)
    : supabaseClient.from('portfolio').insert(portfolio);
  const { data: portfolioRows, error: portfolioError } = await portfolioWrite
    .select('id')
    .single();
  if (portfolioError) throw portfolioError;
  state.portfolioId = String(portfolioRows.id);

  const collections = [
    ['projects', state.projects, projectFromState],
    ['skills', state.skills || [], item => ({
      id: numericIdOrNew(item.id),
      skill_name: item.skill_name || item.name || '',
      category: item.category || '',
      proficiency: Number.isFinite(Number(item.proficiency)) ? Number(item.proficiency) : null
    })],
    ['certificates', state.certifications, item => ({
      id: numericIdOrNew(item.id),
      title: item.title || '',
      issuer: item.issuer || '',
      issue_date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null,
      certificate_url: item.certificateUrl || null,
      verification_details: item.date || null
    })],
    ['education', state.education, item => ({
      id: numericIdOrNew(item.id),
      degree: item.degree || '',
      institution: item.institution || '',
      start_year: item.startYear || null,
      end_year: item.endYear || null,
      cgpa: item.cgpa || null
    })],
    ['research', state.research, item => ({
      id: numericIdOrNew(item.id),
      title: item.title || '', venue: item.venue || '', year: item.year || '',
      authors: item.authors || '', abstract: item.abstract || '', link: item.link || ''
    })],
    ['internships', state.internships, item => ({
      id: numericIdOrNew(item.id),
      role: item.role || '', company: item.company || '', period: item.period || '',
      description: item.desc || ''
    })],
    ['books', state.books, item => ({
      id: numericIdOrNew(item.id),
      title: item.title || '', publisher: item.publisher || '',
      synopsis: item.synopsis || '', url: item.url || ''
    })]
  ];

  for (const [table, rows, mapper] of collections) {
    await upsertRows(table, rows || [], userId, mapper);
    await deleteMissingRows(table, rows || [], userId);
  }
}

window.portfolioSupabase = {
  client: supabaseClient,
  projectToState,
  certificateToState,
  internshipToState,
  researchToState,
  bookToState,
  loadPortfolioData,
  savePortfolioData,
  getSession: () => supabaseClient.auth.getSession(),
  signInWithOtp: (email, emailRedirectTo) => supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: false
    }
  }),
  signOut: () => supabaseClient.auth.signOut(),
  onAuthStateChange: callback => supabaseClient.auth.onAuthStateChange(callback),
  verifyOwner: async userId => {
    const { data, error } = await supabaseClient
      .from('portfolio')
      .select('id, owner_id')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
};
