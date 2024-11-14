import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { format } from 'date-fns';


// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'medical_records_db',
  password: 'your_password',
  port: 5432,
});

// Constants for data generation
const NUM_PATIENTS = 100;
const NUM_PROVIDERS = 50;
const NUM_FACILITIES = 10;
const NUM_DEPARTMENTS = 20;
const RECORDS_PER_PATIENT = 1000;

// Utility to generate random date in last 5 years
const randomDate = () => {
  const start = new Date(2019, 0, 1);
  const end = new Date();
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

// Schema creation
const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      BEGIN;

      CREATE TABLE IF NOT EXISTS facilities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        facility_id INTEGER REFERENCES facilities(id),
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS healthcare_providers (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id),
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        specialty VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TYPE record_type AS ENUM ('lab_result', 'prescription', 'diagnosis', 'procedure');

      CREATE TABLE IF NOT EXISTS medical_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id),
        provider_id INTEGER REFERENCES healthcare_providers(id),
        facility_id INTEGER REFERENCES facilities(id),
        department_id INTEGER REFERENCES departments(id),
        record_type record_type NOT NULL,
        record_date TIMESTAMP WITH TIME ZONE NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        -- JSON fields for type-specific data
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for efficient filtering and joining
      CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_record_date ON medical_records(record_date);
      CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(record_type);
      CREATE INDEX IF NOT EXISTS idx_medical_records_facility ON medical_records(facility_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_provider ON medical_records(provider_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_department ON medical_records(department_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_data ON medical_records USING gin(data);

      COMMIT;
    `);
  } finally {
    client.release();
  }
};

// Data generation functions
const generateFacilities = async () => {
  const facilities = Array.from({ length: NUM_FACILITIES }, () => ({
    name: faker.company.name() + ' Medical Center',
    address: faker.location.streetAddress() + ', ' + faker.location.city(),
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const facility of facilities) {
      await client.query(
        'INSERT INTO facilities (name, address) VALUES ($1, $2)',
        [facility.name, facility.address]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const generateDepartments = async () => {
  const departments = [
    'Cardiology',
    'Neurology',
    'Oncology',
    'Pediatrics',
    'Emergency',
    'Surgery',
    'Radiology',
    'Pathology',
    'Internal Medicine',
    'Orthopedics',
    'Psychiatry',
    'Dermatology',
    'Ophthalmology',
    'ENT',
    'Urology',
    'Gynecology',
    'Dental',
    'Physical Therapy',
    'Nutrition',
    'Pharmacy',
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < NUM_DEPARTMENTS; i++) {
      const facilityId = Math.floor(Math.random() * NUM_FACILITIES) + 1;
      await client.query(
        'INSERT INTO departments (facility_id, name) VALUES ($1, $2)',
        [facilityId, departments[i]]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const generateProviders = async () => {
  const specialties = [
    'Cardiologist',
    'Neurologist',
    'Oncologist',
    'Pediatrician',
    'Emergency Physician',
    'Surgeon',
    'Radiologist',
    'Pathologist',
    'Internist',
    'Orthopedist',
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < NUM_PROVIDERS; i++) {
      const departmentId = Math.floor(Math.random() * NUM_DEPARTMENTS) + 1;
      await client.query(
        'INSERT INTO healthcare_providers (department_id, first_name, last_name, specialty) VALUES ($1, $2, $3, $4)',
        [
          departmentId,
          faker.person.firstName(),
          faker.person.lastName(),
          specialties[Math.floor(Math.random() * specialties.length)],
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const generatePatients = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < NUM_PATIENTS; i++) {
      await client.query(
        'INSERT INTO patients (first_name, last_name, date_of_birth, gender) VALUES ($1, $2, $3, $4)',
        [
          faker.person.firstName(),
          faker.person.lastName(),
          faker.date.between({ from: '1940-01-01', to: '2005-12-31' }),
          faker.person.sex(),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const generateMedicalRecords = async () => {
  const recordTypes = ['lab_result', 'prescription', 'diagnosis', 'procedure'];

  const generateRecordData = (type) => {
    switch (type) {
      case 'lab_result':
        return {
          test_name: faker.science.chemicalElement().name,
          result_value: faker.number.float({
            min: 0,
            max: 100,
            precision: 0.1,
          }),
          unit: faker.science.unit().symbol,
          reference_range: `${faker.number.float({
            min: 0,
            max: 50,
          })} - ${faker.number.float({ min: 51, max: 100 })}`,
          is_abnormal: faker.datatype.boolean(),
        };
      case 'prescription':
        return {
          medication_name: faker.science.chemicalElement().name,
          dosage: `${faker.number.int({ min: 1, max: 1000 })}mg`,
          frequency: `${faker.number.int({ min: 1, max: 4 })} times daily`,
          duration_days: faker.number.int({ min: 1, max: 90 }),
          refills: faker.number.int({ min: 0, max: 3 }),
        };
      case 'diagnosis':
        return {
          condition: faker.medicine.diagnosisCode(),
          severity: faker.helpers.arrayElement(['Mild', 'Moderate', 'Severe']),
          notes: faker.lorem.sentence(),
          is_chronic: faker.datatype.boolean(),
        };
      case 'procedure':
        return {
          procedure_name: faker.medicine.procedureDescription(),
          duration_minutes: faker.number.int({ min: 15, max: 240 }),
          outcome: faker.helpers.arrayElement([
            'Successful',
            'Partially Successful',
            'Incomplete',
          ]),
          complications: faker.helpers.arrayElement(['None', 'Minor', 'Major']),
          follow_up_required: faker.datatype.boolean(),
        };
      default:
        return {};
    }
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate records for each patient
    for (let patientId = 1; patientId <= NUM_PATIENTS; patientId++) {
      const recordsToInsert = [];

      // Generate RECORDS_PER_PATIENT records for this patient
      for (let j = 0; j < RECORDS_PER_PATIENT; j++) {
        const recordType =
          recordTypes[Math.floor(Math.random() * recordTypes.length)];
        const record = {
          patient_id: patientId,
          provider_id: Math.floor(Math.random() * NUM_PROVIDERS) + 1,
          facility_id: Math.floor(Math.random() * NUM_FACILITIES) + 1,
          department_id: Math.floor(Math.random() * NUM_DEPARTMENTS) + 1,
          record_type: recordType,
          record_date: randomDate(),
          description: faker.lorem.sentence(),
          status: faker.helpers.arrayElement([
            'Active',
            'Completed',
            'Cancelled',
            'Pending',
          ]),
          data: generateRecordData(recordType),
        };
        recordsToInsert.push(record);
      }

      // Bulk insert records for this patient
      const values = recordsToInsert
        .map(
          (record, idx) => `(
        $${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, 
        $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, 
        $${idx * 9 + 9}
      )`
        )
        .join(',');

      const flatParams = recordsToInsert.flatMap((record) => [
        record.patient_id,
        record.provider_id,
        record.facility_id,
        record.department_id,
        record.record_type,
        record.record_date,
        record.description,
        record.status,
        record.data,
      ]);

      await client.query(
        `
        INSERT INTO medical_records (
          patient_id, provider_id, facility_id, department_id,
          record_type, record_date, description, status, data
        ) VALUES ${values}
      `,
        flatParams
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// Main execution function
const seedDatabase = async () => {
  try {
    console.log('Creating tables...');
    await createTables();

    console.log('Generating facilities...');
    await generateFacilities();

    console.log('Generating departments...');
    await generateDepartments();

    console.log('Generating healthcare providers...');
    await generateProviders();

    console.log('Generating patients...');
    await generatePatients();

    console.log('Generating medical records...');
    await generateMedicalRecords();

    console.log('Data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
};

// Execute the seeding
seedDatabase();
